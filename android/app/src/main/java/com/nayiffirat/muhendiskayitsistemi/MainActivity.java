package com.nayiffirat.muhendiskayitsistemi;

import android.app.Dialog;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.File;
import java.io.FileOutputStream;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Dialog authPopupDialog;
    private boolean pdfBridgeAttached = false;

    /** Web tarafında üretilen PDF'leri önbelleğe yazar ve PDF görüntüleyici / paylaş menüsünü açar. */
    private class PdfBridge {
        private File currentFile;
        private FileOutputStream out;

        @JavascriptInterface
        public synchronized boolean begin(String name) {
            try {
                closeQuietly();
                String safe = (name == null ? "MKS_Belge.pdf" : name).replaceAll("[\\\\/:*?\"<>|]", "_");
                if (!safe.toLowerCase().endsWith(".pdf")) safe = safe + ".pdf";
                File dir = new File(getCacheDir(), "pdf");
                if (!dir.exists() && !dir.mkdirs()) return false;
                currentFile = new File(dir, safe);
                out = new FileOutputStream(currentFile, false);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public synchronized boolean append(String chunkBase64) {
            try {
                if (out == null) return false;
                out.write(Base64.decode(chunkBase64, Base64.DEFAULT));
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public synchronized boolean finish(String mode) {
            try {
                if (out == null || currentFile == null) return false;
                out.flush();
                closeQuietly();
                final File file = currentFile;
                final Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                final Intent intent;
                if ("share".equals(mode)) {
                    intent = new Intent(Intent.ACTION_SEND);
                    intent.setType("application/pdf");
                    intent.putExtra(Intent.EXTRA_STREAM, uri);
                } else {
                    intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(uri, "application/pdf");
                }
                intent.setClipData(ClipData.newRawUri(file.getName(), uri));
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                final Intent chooser = Intent.createChooser(intent, file.getName());
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> {
                    try {
                        startActivity(chooser);
                    } catch (Exception ignored) {
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        private void closeQuietly() {
            try {
                if (out != null) out.close();
            } catch (Exception ignored) {
            }
            out = null;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Native status bar & navigation bar theme colors
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.parseColor("#080D14"));
        getWindow().setNavigationBarColor(Color.parseColor("#080D14"));

        // Not: onResume'da değil burada çağrılmalı (aksi halde açılışta IllegalStateException ile çöker)
        configureWebView();

        final View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            contentView.setBackgroundColor(Color.parseColor("#080D14"));
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime()
                );
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
        }
    }

    private boolean webViewConfigured = false;

    private void configureWebView() {
        if (webViewConfigured) return;
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final WebView webView = getBridge().getWebView();
        webViewConfigured = true;

        if (!pdfBridgeAttached) {
            webView.addJavascriptInterface(new PdfBridge(), "MksNative");
            pdfBridgeAttached = true;
        }

        // 1. Remove overscroll stretch / bounce
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // 2. Enable multiple windows for Google OAuth popup
        WebSettings settings = webView.getSettings();
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setDomStorageEnabled(true);

        // Not: düz WebChromeClient kullanmak Capacitor'ın konum, kamera ve dosya seçici izin akışını devre dışı bırakıyordu.
        webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView popupWebView = new WebView(MainActivity.this);
                WebSettings popupSettings = popupWebView.getSettings();
                popupSettings.setJavaScriptEnabled(true);
                popupSettings.setDomStorageEnabled(true);
                popupSettings.setSupportMultipleWindows(true);
                popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                popupSettings.setUserAgentString(settings.getUserAgentString());

                authPopupDialog = new Dialog(MainActivity.this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
                authPopupDialog.setContentView(popupWebView);
                authPopupDialog.show();

                popupWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        if (authPopupDialog != null && authPopupDialog.isShowing()) {
                            authPopupDialog.dismiss();
                            authPopupDialog = null;
                        }
                    }
                });

                popupWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        return false;
                    }

                    @Override
                    public void onPageFinished(WebView v, String url) {
                        super.onPageFinished(v, url);
                        if (url != null && (url.contains("/__/auth/handler") || url.contains("close"))) {
                            // If handler finishes and opener has token, dialog can close
                        }
                    }
                });

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                if (authPopupDialog != null && authPopupDialog.isShowing()) {
                    authPopupDialog.dismiss();
                    authPopupDialog = null;
                }
            }
        });
    }
}
