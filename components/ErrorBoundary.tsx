import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { dbService } from '../services/db';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    dbService.addSystemError({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source: 'ErrorBoundary',
      message: error.message,
      stack: error.stack,
      userEmail: localStorage.getItem('mks_user_email') || 'Bilinmiyor'
    }).catch(() => {});
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Beklenmedik bir hata oluştu.";
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            isFirestoreError = true;
            if (parsed.error.includes('permission-denied') || parsed.error.includes('insufficient permissions')) {
              errorMessage = "Erişim yetkiniz bulunmuyor. Lütfen yönetici ile iletişime geçin veya tekrar giriş yapın.";
            } else if (parsed.error.includes('offline')) {
              errorMessage = "İnternet bağlantısı kurulamadı. Lütfen bağlantınızı kontrol edin.";
            } else {
              errorMessage = `Veritabanı hatası: ${parsed.operationType}`;
            }
          }
        }
      } catch (e) {
        // Not a JSON error
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Bir Şeyler Yanlış Gitti
            </h1>
            
            <p className="text-gray-600 mb-8">
              {errorMessage}
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-green-200"
              >
                <RefreshCcw className="w-5 h-5" />
                Uygulamayı Yeniden Başlat
              </button>
              
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors"
              >
                Geri Dön
              </button>
            </div>

            {isFirestoreError && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-mono break-all">
                  Hata Kodu: {this.state.error?.message.substring(0, 100)}...
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
