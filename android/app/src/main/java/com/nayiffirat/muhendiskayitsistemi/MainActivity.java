package com.nayiffirat.muhendiskayitsistemi;

import android.app.Dialog;
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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Native status bar & navigation bar theme colors
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.parseColor("#080D14"));
        getWindow().setNavigationBarColor(Color.parseColor("#080D14"));

        final View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime()
                );
                view.setPadding(bars.left, 0, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
    }

    private void configureWebView() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final WebView webView = getBridge().getWebView();

        // 1. Remove overscroll stretch / bounce
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        // 2. Enable multiple windows for Google OAuth popup
        WebSettings settings = webView.getSettings();
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setDomStorageEnabled(true);

        webView.setWebChromeClient(new WebChromeClient() {
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
