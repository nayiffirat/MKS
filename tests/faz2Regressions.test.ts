import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalDateString } from '../utils/dateUtils';
import { SPRAY_THRESHOLDS, evaluateSprayingConditions, isWetWeatherCode } from '../services/weather';
import { buildWaUrl, normalizeWaPhone } from '../utils/whatsappTemplates';
import { computePolygonMetrics, geoJsonToLatLngs } from '../utils/fieldPolygon';

test('getLocalDateString — preserves local midnight calendar date without UTC shift', () => {
  const localJustAfterMidnight = new Date(2026, 0, 1, 0, 15, 0);
  assert.equal(getLocalDateString(localJustAfterMidnight), '2026-01-01');

  const localLateNight = new Date(2026, 11, 31, 23, 55, 0);
  assert.equal(getLocalDateString(localLateNight), '2026-12-31');

  assert.equal(getLocalDateString('2026-11-15'), '2026-11-15');
  assert.equal(getLocalDateString('2026-11-15T23:45:00'), '2026-11-15');
  assert.match(getLocalDateString('not-a-date'), /^\d{4}-\d{2}-\d{2}$/);
});

test('evaluateSprayingConditions — unified thresholds across weather and advice views', () => {
  assert.equal(isWetWeatherCode(61), true);
  assert.equal(isWetWeatherCode(0), false);

  const ideal = evaluateSprayingConditions({
    tempC: 20,
    humidity: 60,
    windKmh: 8,
    gustKmh: 12,
    precipProb: 0,
    weatherCode: 0,
  });
  assert.equal(ideal.level, 'IDEAL');

  const highWind = evaluateSprayingConditions({
    tempC: 20,
    humidity: 60,
    windKmh: SPRAY_THRESHOLDS.maxWindKmh + 1,
    weatherCode: 0,
  });
  assert.equal(highWind.level, 'UYGUNSUZ');

  const highGust = evaluateSprayingConditions({
    tempC: 20,
    humidity: 60,
    windKmh: 10,
    gustKmh: SPRAY_THRESHOLDS.maxGustKmh + 1,
    weatherCode: 0,
  });
  assert.equal(highGust.level, 'UYGUNSUZ');

  const hotWeather = evaluateSprayingConditions({
    tempC: SPRAY_THRESHOLDS.maxTempC + 1,
    windKmh: 5,
    weatherCode: 0,
  });
  assert.equal(hotWeather.level, 'UYGUNSUZ');

  const cautionWind = evaluateSprayingConditions({
    tempC: 20,
    humidity: 60,
    windKmh: SPRAY_THRESHOLDS.cautionWindKmh + 1,
    weatherCode: 0,
  });
  assert.equal(cautionWind.level, 'DIKKAT');
});

test('normalizeWaPhone & buildWaUrl — Turkish and international numbers', () => {
  assert.equal(normalizeWaPhone('0532 123 45 67'), '905321234567');
  assert.equal(normalizeWaPhone('+90 (532) 123-45-67'), '905321234567');
  assert.equal(normalizeWaPhone('5321234567'), '905321234567');
  assert.equal(normalizeWaPhone('0049 170 1234567'), '491701234567');
  assert.equal(normalizeWaPhone(''), '');
  assert.equal(normalizeWaPhone('12345'), '');

  assert.equal(buildWaUrl('0532 123 45 67'), 'https://wa.me/905321234567');
  assert.equal(
    buildWaUrl('0532 123 45 67', 'Merhaba çiftçi'),
    'https://wa.me/905321234567?text=Merhaba%20%C3%A7ift%C3%A7i'
  );
  assert.equal(buildWaUrl('invalid', 'Merhaba'), '');
});

test('geoJsonToLatLngs & computePolygonMetrics — parses GeoJSON polygon and computes positive centroid/area', () => {
  const geo = JSON.stringify({
    type: 'Polygon',
    coordinates: [[[32.5, 37.8], [32.501, 37.8], [32.501, 37.801], [32.5, 37.801], [32.5, 37.8]]]
  });
  const pts = geoJsonToLatLngs(geo);
  assert.ok(pts.length >= 3);
  const metrics = computePolygonMetrics(pts);
  assert.ok(metrics.dekar > 0);
  assert.ok(metrics.areaM2 > 0);
  assert.ok(Math.abs(metrics.centroid.lat - 37.8005) < 0.01);
  assert.ok(Math.abs(metrics.centroid.lng - 32.5005) < 0.01);
});
