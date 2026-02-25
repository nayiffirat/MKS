
import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary must be a class component to implement static getDerivedStateFromError and componentDidCatch.
 * This component catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI.
 */
// Fix: Explicitly extending React.Component and declaring state as a class property ensures 'props' and 'state' are correctly typed and recognized by the TypeScript compiler.
export class ErrorBoundary extends React.Component<Props, State> {
  // Fix: Explicitly declaring props as a class property ensures it is recognized by the TypeScript compiler on the class instance.
  public props: Props;
  // Fix: Declaring state as a class property ensures it is recognized on the class instance.
  public state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    // Fix: Initializing props locally to satisfy the TypeScript compiler's property check.
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    // Fix: Accessing state and props directly from this instance of React.Component.
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={40} />
          </div>
          <h1 className="text-xl font-bold text-stone-200 mb-2">Bir şeyler ters gitti</h1>
          <p className="text-stone-500 text-sm mb-6 max-w-xs">
            Uygulama beklenmeyen bir hatayla karşılaştı. Lütfen tekrar deneyin.
          </p>
          <div className="bg-stone-900 p-4 rounded-lg mb-6 max-w-full overflow-auto border border-red-900/30">
             <code className="text-xs text-red-400 font-mono">
                {error?.message}
             </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center px-6 py-3 bg-emerald-700 text-white rounded-xl font-bold hover:bg-emerald-600 transition-colors"
          >
            <RefreshCw size={18} className="mr-2" /> Yeniden Başlat
          </button>
        </div>
      );
    }

    return children;
  }
}
