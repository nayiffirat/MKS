import { openDB, DBSchema } from 'idb';
import { Farmer, Pesticide, VisitLog, Prescription } from '../types';
import { MOCK_PESTICIDES } from '../constants';

interface AgriDB extends DBSchema {
  farmers: {
    key: string;
    value: Farmer;
    indexes: { 'by-name': string };
  };
  pesticides: {
    key: string;
    value: Pesticide;
  };
  visits: {
    key: string;
    value: VisitLog;
    indexes: { 'by-farmer': string };
  };
  prescriptions: {
    key: string;
    value: Prescription;
    indexes: { 'by-farmer': string };
  };
}

const DB_NAME = 'agri-engineer-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB<AgriDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Farmers Table
      const farmerStore = db.createObjectStore('farmers', { keyPath: 'id' });
      farmerStore.createIndex('by-name', 'fullName');

      // Pesticides Table
      const pesticideStore = db.createObjectStore('pesticides', { keyPath: 'id' });
      // Seed initial data
      MOCK_PESTICIDES.forEach(p => pesticideStore.put(p));

      // Visit Logs Table
      const visitStore = db.createObjectStore('visits', { keyPath: 'id' });
      visitStore.createIndex('by-farmer', 'farmerId');

      // Prescriptions Table
      const prescriptionStore = db.createObjectStore('prescriptions', { keyPath: 'id' });
      prescriptionStore.createIndex('by-farmer', 'farmerId');
    },
  });
};

export const dbService = {
  async getFarmers() {
    const db = await initDB();
    return db.getAll('farmers');
  },
  async addFarmer(farmer: Farmer) {
    const db = await initDB();
    return db.put('farmers', farmer);
  },
  async getFarmer(id: string) {
    const db = await initDB();
    return db.get('farmers', id);
  },
  async getPesticides() {
    const db = await initDB();
    return db.getAll('pesticides');
  },
  async addVisit(visit: VisitLog) {
    const db = await initDB();
    return db.put('visits', visit);
  },
  async getVisitsByFarmer(farmerId: string) {
    const db = await initDB();
    return db.getAllFromIndex('visits', 'by-farmer', farmerId);
  },
  async addPrescription(prescription: Prescription) {
    const db = await initDB();
    return db.put('prescriptions', prescription);
  },
  async getPrescriptionsByFarmer(farmerId: string) {
    const db = await initDB();
    return db.getAllFromIndex('prescriptions', 'by-farmer', farmerId);
  },
  async getAllPrescriptions() {
    const db = await initDB();
    return db.getAll('prescriptions');
  },
  async getAllVisits() {
    const db = await initDB();
    return db.getAll('visits');
  }
};