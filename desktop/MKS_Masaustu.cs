using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("MKS Mühendis Kayıt Sistemi")]
[assembly: AssemblyDescription("MKS Çiftçi Cari, Depo Stok, BKTS/GTS ve e-Fatura Kurumsal Masaüstü Uygulaması")]
[assembly: AssemblyCompany("MKS Dijital Tarım")]
[assembly: AssemblyProduct("MKS Masaüstü v8.2.1")]
[assembly: AssemblyVersion("8.2.1.0")]
[assembly: AssemblyFileVersion("8.2.1.0")]

namespace MksDesktop
{
    internal static class NativeMethods
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll")]
        public static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsZoomed(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        public static extern bool SetWindowPos(
            IntPtr hWnd,
            IntPtr hWndInsertAfter,
            int X,
            int Y,
            int cx,
            int cy,
            uint uFlags
        );

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
        private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

        public static void SetOwnerWindow(IntPtr childHwnd, IntPtr ownerHwnd)
        {
            const int GWL_HWNDPARENT = -8;
            if (IntPtr.Size == 8)
            {
                SetWindowLongPtr64(childHwnd, GWL_HWNDPARENT, ownerHwnd);
            }
            else
            {
                SetWindowLong32(childHwnd, GWL_HWNDPARENT, ownerHwnd.ToInt32());
            }
        }

        [DllImport("dwmapi.dll")]
        public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

        [DllImport("gdi32.dll")]
        public static extern IntPtr CreateRoundRectRgn(int x1, int y1, int x2, int y2, int cx, int cy);

        [DllImport("gdi32.dll")]
        public static extern bool DeleteObject(IntPtr hObject);

        public const int SW_HIDE = 0;
        public const int SW_SHOWNORMAL = 1;
        public const int SW_MAXIMIZE = 3;
        public const int SW_MINIMIZE = 6;
        public const int SW_RESTORE = 9;
        public const uint WM_CLOSE = 0x0010;

        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_NOACTIVATE = 0x0010;
        public const uint SWP_SHOWWINDOW = 0x0040;

        public const int DWMWA_CAPTION_BUTTON_BOUNDS = 5;
        public const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    }

    internal sealed class TitlebarUpdateOverlayForm : Form
    {
        private readonly string _appDataDir;
        private readonly string _activeOrigin;
        private readonly int _bridgePort;
        private readonly System.Windows.Forms.Timer _geometryTimer;
        private readonly System.Windows.Forms.Timer _versionPollTimer;
        private TcpListener _bridgeListener;
        private volatile bool _shuttingDown;

        private IntPtr _mksHwnd = IntPtr.Zero;
        private IntPtr _lastBoundOwner = IntPtr.Zero;
        private readonly DateTime _startedAtUtc = DateTime.UtcNow;
        private bool _everFoundMksWindow;

        private volatile bool _updateAvailable;
        private volatile bool _isUpdating;
        private string _remoteVersion = "8.2.1";
        private int _remoteBuild = Program.CurrentDesktopBuild;
        private string _remoteDownloadUrl = "";

        private Rectangle _rectUpdate = Rectangle.Empty;
        private Rectangle _rectFolder = Rectangle.Empty;
        private Rectangle _rectPdf = Rectangle.Empty;
        private Rectangle _rectPrint = Rectangle.Empty;
        private int _hoveredBtn = -1; // 0: Update, 1: Folder, 2: PDF, 3: Print
        private ToolTip _toolTip;
        private PdfQuickAccessPopupForm _activePopup;

        public TitlebarUpdateOverlayForm(string appDataDir, string activeOrigin, int bridgePort, TcpListener bridgeListener)
        {
            _appDataDir = appDataDir;
            _activeOrigin = activeOrigin.TrimEnd('/');
            _bridgePort = bridgePort;
            _bridgeListener = bridgeListener;

            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            DoubleBuffered = true;
            BackColor = Color.FromArgb(15, 23, 42); // slate-900
            ForeColor = Color.White;
            Cursor = Cursors.Hand;
            Size = new Size(200, 24);
            Location = new Point(-2000, -2000);
            Visible = false;

            _toolTip = new ToolTip { InitialDelay = 200, ReshowDelay = 100, AutoPopDelay = 5000 };

            MouseMove += OnOverlayMouseMove;
            MouseLeave += OnOverlayMouseLeave;
            MouseClick += OnOverlayMouseClick;

            _geometryTimer = new System.Windows.Forms.Timer { Interval = 35 };
            _geometryTimer.Tick += OnGeometryTick;
            _geometryTimer.Start();

            _versionPollTimer = new System.Windows.Forms.Timer { Interval = 45000 };
            _versionPollTimer.Tick += (s, e) => ThreadPool.QueueUserWorkItem(_ => CheckRemoteVersionOnce());
            _versionPollTimer.Start();

            Thread bridgeThread = new Thread(BridgeLoop) { IsBackground = true, Name = "MKS_Desktop_Bridge" };
            bridgeThread.Start();

            // İlk güncelleme kontrolü (pencere açıldıktan 4 sn sonra)
            ThreadPool.QueueUserWorkItem(_ =>
            {
                Thread.Sleep(4000);
                CheckRemoteVersionOnce();
            });
        }

        protected override CreateParams CreateParams
        {
            get
            {
                const int WS_EX_TOOLWINDOW = 0x00000080;
                const int WS_EX_NOACTIVATE = 0x08000000;
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
                return cp;
            }
        }

        protected override bool ShowWithoutActivation
        {
            get { return true; }
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            Region = null;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            using (SolidBrush bgBrush = new SolidBrush(Color.FromArgb(15, 23, 42)))
            {
                g.FillRectangle(bgBrush, ClientRectangle);
            }

            using (Font f = new Font("Segoe UI Semibold", 8f, FontStyle.Bold, GraphicsUnit.Point))
            using (StringFormat sf = new StringFormat
            {
                Alignment = StringAlignment.Center,
                LineAlignment = StringAlignment.Center,
                FormatFlags = StringFormatFlags.NoWrap
            })
            {
                // 1. Güncelleme Butonu (Mevcutsa)
                if (!_rectUpdate.IsEmpty)
                {
                    Color bgUp = _isUpdating
                        ? Color.FromArgb(4, 120, 87)
                        : (_hoveredBtn == 0 ? Color.FromArgb(16, 185, 129) : Color.FromArgb(5, 150, 105));
                    Color borderUp = Color.FromArgb(110, 167, 243, 208);
                    string labelUp = _isUpdating ? "↻ Güncelleniyor..." : string.Format("↻ Güncelle (v{0})", _remoteVersion);

                    DrawButtonPill(g, _rectUpdate, bgUp, borderUp, labelUp, Color.White, f, sf);
                }

                // 2. Klasör Butonu
                Color bgFolder = _hoveredBtn == 1 ? Color.FromArgb(51, 65, 85) : Color.FromArgb(30, 41, 59);
                Color borderFolder = _hoveredBtn == 1 ? Color.FromArgb(148, 163, 184) : Color.FromArgb(71, 85, 105);
                DrawButtonPill(g, _rectFolder, bgFolder, borderFolder, "Klasör", Color.FromArgb(241, 245, 249), f, sf);

                // 3. Kalıcı Kırmızı PDF Butonu
                Color bgPdf = _hoveredBtn == 2 ? Color.FromArgb(244, 63, 94) : Color.FromArgb(225, 29, 72);
                Color borderPdf = _hoveredBtn == 2 ? Color.FromArgb(254, 205, 211) : Color.FromArgb(244, 63, 94);
                DrawButtonPill(g, _rectPdf, bgPdf, borderPdf, "PDF", Color.White, f, sf);

                // 4. Yazdır Butonu
                Color bgPrint = _hoveredBtn == 3 ? Color.FromArgb(8, 145, 178) : Color.FromArgb(14, 116, 144);
                Color borderPrint = _hoveredBtn == 3 ? Color.FromArgb(34, 211, 238) : Color.FromArgb(6, 182, 212);
                DrawButtonPill(g, _rectPrint, bgPrint, borderPrint, "Yazdır", Color.White, f, sf);
            }
        }

        private static void DrawButtonPill(Graphics g, Rectangle r, Color bg, Color border, string text, Color textColor, Font f, StringFormat sf)
        {
            if (r.Width <= 0 || r.Height <= 0) return;
            using (GraphicsPath path = new GraphicsPath())
            {
                int radius = 5;
                int d = radius * 2;
                Rectangle arcRect = new Rectangle(r.X, r.Y, d, d);

                path.AddArc(arcRect, 180, 90);
                arcRect.X = r.Right - d;
                path.AddArc(arcRect, 270, 90);
                arcRect.Y = r.Bottom - d;
                path.AddArc(arcRect, 0, 90);
                arcRect.X = r.X;
                path.AddArc(arcRect, 90, 90);
                path.CloseFigure();

                using (SolidBrush b = new SolidBrush(bg))
                {
                    g.FillPath(b, path);
                }
                using (Pen p = new Pen(border, 1f))
                {
                    g.DrawPath(p, path);
                }
                using (SolidBrush tb = new SolidBrush(textColor))
                {
                    g.DrawString(text, f, tb, r, sf);
                }
            }
        }

        private void OnOverlayMouseMove(object sender, MouseEventArgs e)
        {
            int newHover = -1;
            if (!_rectUpdate.IsEmpty && _rectUpdate.Contains(e.Location)) newHover = 0;
            else if (_rectFolder.Contains(e.Location)) newHover = 1;
            else if (_rectPdf.Contains(e.Location)) newHover = 2;
            else if (_rectPrint.Contains(e.Location)) newHover = 3;

            if (newHover != _hoveredBtn)
            {
                _hoveredBtn = newHover;
                Invalidate();
                if (_toolTip != null)
                {
                    string tip = "";
                    if (_hoveredBtn == 0) tip = "Yeni MKS sürümünü yükle";
                    else if (_hoveredBtn == 1) tip = "İndirilen PDF Klasörünü Aç (Bilgisayardaki konuma gider)";
                    else if (_hoveredBtn == 2) tip = "Son İndirilen PDF Belgelerini Göster & Aç";
                    else if (_hoveredBtn == 3) tip = "Yazıcıya Gönder / Sayfayı Yazdır (Ctrl+P)";

                    if (!string.IsNullOrEmpty(tip))
                        _toolTip.SetToolTip(this, tip);
                    else
                        _toolTip.Hide(this);
                }
            }
        }

        private void OnOverlayMouseLeave(object sender, EventArgs e)
        {
            _hoveredBtn = -1;
            Invalidate();
            if (_toolTip != null) _toolTip.Hide(this);
        }

        private void OnOverlayMouseClick(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;

            if (!_rectUpdate.IsEmpty && _rectUpdate.Contains(e.Location))
            {
                TriggerSelfUpdate(null);
            }
            else if (_rectFolder.Contains(e.Location))
            {
                OpenPdfFolder(_appDataDir);
            }
            else if (_rectPdf.Contains(e.Location))
            {
                TogglePdfQuickAccessPopup();
            }
            else if (_rectPrint.Contains(e.Location))
            {
                QuickPrintLatestPdf();
            }
        }

        public void TogglePdfQuickAccessPopup()
        {
            if (_activePopup != null && !_activePopup.IsDisposed && _activePopup.Visible)
            {
                _activePopup.Hide();
                return;
            }

            if (_activePopup == null || _activePopup.IsDisposed)
            {
                _activePopup = new PdfQuickAccessPopupForm(_appDataDir, _mksHwnd);
            }

            _activePopup.RefreshFiles();
            Point screenPt = PointToScreen(new Point(_rectPdf.Left, _rectPdf.Bottom + 2));
            int popupX = Math.Max(10, screenPt.X - 220);
            _activePopup.Location = new Point(popupX, screenPt.Y);
            _activePopup.Show();
            _activePopup.BringToFront();
        }

        public static void OpenPdfFolder(string appDataDir)
        {
            try
            {
                string latest = GetMostRecentPdfPath(appDataDir);
                if (!string.IsNullOrEmpty(latest) && File.Exists(latest))
                {
                    Process.Start("explorer.exe", "/select,\"" + latest + "\"");
                    return;
                }

                string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
                if (Directory.Exists(userDownloads))
                {
                    Process.Start("explorer.exe", "\"" + userDownloads + "\"");
                    return;
                }

                if (!string.IsNullOrEmpty(appDataDir))
                {
                    string mksDownloads = Path.Combine(appDataDir, "Downloads");
                    if (Directory.Exists(mksDownloads))
                    {
                        Process.Start("explorer.exe", "\"" + mksDownloads + "\"");
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Klasör açılamadı: " + ex.Message, "MKS", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        public void QuickPrintLatestPdf()
        {
            try
            {
                string latest = GetMostRecentPdfPath(_appDataDir);
                if (!string.IsNullOrEmpty(latest) && File.Exists(latest))
                {
                    FileInfo fi = new FileInfo(latest);
                    DialogResult dr = MessageBox.Show(
                        "Son indirilen belge varsayılan yazıcıya gönderilsin mi?\n\n" +
                        "📄 Belge: " + fi.Name + "\n" +
                        "📅 Tarih: " + fi.LastWriteTime.ToString("dd.MM.yyyy HH:mm") + " (" + (fi.Length / 1024) + " KB)\n\n" +
                        "• EVET: Doğrudan yazıcıya gönder\n" +
                        "• HAYIR: Tüm PDF listesini aç",
                        "MKS Hızlı Yazdırma",
                        MessageBoxButtons.YesNoCancel,
                        MessageBoxIcon.Question
                    );

                    if (dr == DialogResult.Yes)
                    {
                        PrintPdfFile(latest);
                    }
                    else if (dr == DialogResult.No)
                    {
                        TogglePdfQuickAccessPopup();
                    }
                }
                else
                {
                    TriggerPrintCurrentPage(_mksHwnd);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Yazdırma işlemi başlatılamadı:\n" + ex.Message, "MKS Yazdırma", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        public static bool PrintPdfFile(string pdfPath)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = pdfPath,
                    Verb = "print",
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = true
                };
                Process.Start(psi);
                return true;
            }
            catch
            {
                try
                {
                    Process.Start(new ProcessStartInfo { FileName = pdfPath, UseShellExecute = true });
                    return true;
                }
                catch { }
                return false;
            }
        }

        public static void TriggerPrintCurrentPage(IntPtr hwnd)
        {
            try
            {
                IntPtr h = hwnd != IntPtr.Zero ? hwnd : Program.FindMksAppWindow();
                if (h != IntPtr.Zero)
                {
                    NativeMethods.SetForegroundWindow(h);
                    SendKeys.SendWait("^p");
                }
            }
            catch { }
        }

        public static List<FileInfo> GetRecentPdfFiles(string appDataDir, int maxCount)
        {
            List<FileInfo> list = new List<FileInfo>();
            List<string> candidateDirs = new List<string>();

            string userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            if (Directory.Exists(userDownloads)) candidateDirs.Add(userDownloads);

            string userDocs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            if (Directory.Exists(userDocs)) candidateDirs.Add(userDocs);

            string userDesktop = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            if (Directory.Exists(userDesktop)) candidateDirs.Add(userDesktop);

            if (!string.IsNullOrEmpty(appDataDir))
            {
                string mksDownloads = Path.Combine(appDataDir, "Downloads");
                if (Directory.Exists(mksDownloads)) candidateDirs.Add(mksDownloads);

                string webDownloads = Path.Combine(appDataDir, "WebProfile", "Downloads");
                if (Directory.Exists(webDownloads)) candidateDirs.Add(webDownloads);
            }

            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (string dir in candidateDirs)
            {
                try
                {
                    DirectoryInfo di = new DirectoryInfo(dir);
                    FileInfo[] files = di.GetFiles("*.pdf", SearchOption.TopDirectoryOnly);
                    foreach (FileInfo fi in files)
                    {
                        if (seen.Add(fi.FullName))
                        {
                            list.Add(fi);
                        }
                    }
                }
                catch { }
            }

            list.Sort((a, b) => b.LastWriteTime.CompareTo(a.LastWriteTime));
            if (maxCount > 0 && list.Count > maxCount)
            {
                return list.GetRange(0, maxCount);
            }
            return list;
        }

        public static string GetMostRecentPdfPath(string appDataDir)
        {
            List<FileInfo> files = GetRecentPdfFiles(appDataDir, 1);
            if (files != null && files.Count > 0) return files[0].FullName;
            return null;
        }

        private void OnGeometryTick(object sender, EventArgs e)
        {
            if (_shuttingDown) return;

            if (_mksHwnd == IntPtr.Zero || !NativeMethods.IsWindow(_mksHwnd))
            {
                _mksHwnd = Program.FindMksAppWindow();
                if (_mksHwnd != IntPtr.Zero)
                {
                    _everFoundMksWindow = true;
                }
                else
                {
                    if (Visible) Visible = false;
                    double elapsedSec = (DateTime.UtcNow - _startedAtUtc).TotalSeconds;
                    if (!_isUpdating && ((_everFoundMksWindow && elapsedSec > 3.0) || elapsedSec > 25.0))
                    {
                        ShutdownCleanly();
                    }
                    return;
                }
            }

            if (!NativeMethods.IsWindowVisible(_mksHwnd) || NativeMethods.IsIconic(_mksHwnd))
            {
                if (Visible) Visible = false;
                if (_activePopup != null && !_activePopup.IsDisposed && _activePopup.Visible)
                {
                    _activePopup.Hide();
                }
                return;
            }

            if (_lastBoundOwner != _mksHwnd && IsHandleCreated)
            {
                NativeMethods.SetOwnerWindow(Handle, _mksHwnd);
                _lastBoundOwner = _mksHwnd;
            }

            NativeMethods.RECT wr;
            if (!NativeMethods.GetWindowRect(_mksHwnd, out wr)) return;

            float dpiScale = DeviceDpi > 0 ? (DeviceDpi / 96f) : 1f;
            int gap = (int)Math.Round(3 * dpiScale);
            int pillHeight = (int)Math.Round(24 * dpiScale);

            int curX = 0;
            if (_updateAvailable || _isUpdating)
            {
                int wUp = (int)Math.Round(115 * dpiScale);
                _rectUpdate = new Rectangle(curX, 0, wUp, pillHeight);
                curX += wUp + gap;
            }
            else
            {
                _rectUpdate = Rectangle.Empty;
            }

            int wFolder = (int)Math.Round(60 * dpiScale);
            _rectFolder = new Rectangle(curX, 0, wFolder, pillHeight);
            curX += wFolder + gap;

            int wPdf = (int)Math.Round(68 * dpiScale);
            _rectPdf = new Rectangle(curX, 0, wPdf, pillHeight);
            curX += wPdf + gap;

            int wPrint = (int)Math.Round(62 * dpiScale);
            _rectPrint = new Rectangle(curX, 0, wPrint, pillHeight);
            curX += wPrint;

            int totalWidth = curX;

            int captionButtonsScreenLeft;
            int captionTopScreen;
            int captionHeight;

            NativeMethods.RECT btnBounds;
            int hrBtn = NativeMethods.DwmGetWindowAttribute(
                _mksHwnd,
                NativeMethods.DWMWA_CAPTION_BUTTON_BOUNDS,
                out btnBounds,
                Marshal.SizeOf(typeof(NativeMethods.RECT))
            );

            if (hrBtn == 0 && btnBounds.Right > btnBounds.Left)
            {
                captionButtonsScreenLeft = wr.Left + btnBounds.Left;
                captionTopScreen = wr.Top + btnBounds.Top;
                captionHeight = Math.Max(pillHeight + 4, btnBounds.Bottom - btnBounds.Top);
            }
            else
            {
                NativeMethods.RECT frameRect;
                int hrFrame = NativeMethods.DwmGetWindowAttribute(
                    _mksHwnd,
                    NativeMethods.DWMWA_EXTENDED_FRAME_BOUNDS,
                    out frameRect,
                    Marshal.SizeOf(typeof(NativeMethods.RECT))
                );
                if (hrFrame != 0) frameRect = wr;

                captionButtonsScreenLeft = frameRect.Right - (int)Math.Round(140 * dpiScale);
                captionTopScreen = frameRect.Top;
                captionHeight = (int)Math.Round(32 * dpiScale);
            }

            int targetX = captionButtonsScreenLeft - totalWidth - (int)Math.Round(6 * dpiScale);
            int targetY = captionTopScreen + Math.Max(2, (captionHeight - pillHeight) / 2);

            if (Width != totalWidth || Height != pillHeight)
            {
                Size = new Size(totalWidth, pillHeight);
            }

            NativeMethods.SetWindowPos(
                Handle,
                IntPtr.Zero,
                targetX,
                targetY,
                totalWidth,
                pillHeight,
                NativeMethods.SWP_NOACTIVATE | NativeMethods.SWP_NOZORDER | NativeMethods.SWP_SHOWWINDOW
            );

            if (!Visible) Visible = true;
        }

        private int GetEffectiveBaselineBuild()
        {
            int baseline = Program.CurrentDesktopBuild;
            try
            {
                string ackFile = Path.Combine(_appDataDir, "ack_build.txt");
                if (File.Exists(ackFile))
                {
                    int ack;
                    if (int.TryParse((File.ReadAllText(ackFile) ?? "").Trim(), out ack) && ack > baseline)
                    {
                        baseline = ack;
                    }
                }
            }
            catch { }
            return baseline;
        }

        private void CheckRemoteVersionOnce()
        {
            if (_shuttingDown || _isUpdating) return;

            int baseline = GetEffectiveBaselineBuild();
            string[] urls = new[]
            {
                _activeOrigin + "/api/version?t=" + Environment.TickCount,
                _activeOrigin + "/version.json?t=" + Environment.TickCount,
                Program.FirestoreReleaseDocUrl
            };

            foreach (string u in urls)
            {
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(u);
                    req.Method = "GET";
                    req.Timeout = 6000;
                    req.ReadWriteTimeout = 6000;
                    req.CachePolicy = new System.Net.Cache.RequestCachePolicy(System.Net.Cache.RequestCacheLevel.NoCacheNoStore);

                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    {
                        string body = sr.ReadToEnd();
                        int foundBuild = ExtractBuildNumber(body);
                        string foundVer = ExtractVersionString(body);
                        if (foundBuild > baseline)
                        {
                            ActivateUpdateBanner(
                                string.IsNullOrEmpty(foundVer) ? "Yeni" : foundVer,
                                foundBuild,
                                _activeOrigin + "/downloads/MKS_Masaustu_Kurulum.exe"
                            );
                            return;
                        }
                    }
                }
                catch
                {
                    // Sonraki kaynağı dene
                }
            }
        }

        private static int ExtractBuildNumber(string json)
        {
            if (string.IsNullOrEmpty(json)) return 0;

            // 1) Standard JSON: "desktopBuild": 29 or "build": 29
            Match m1 = Regex.Match(json, "\"(?:desktopBuild|build)\"\\s*:\\s*(\\d+)");
            if (m1.Success)
            {
                int b;
                if (int.TryParse(m1.Groups[1].Value, out b)) return b;
            }

            // 2) Firestore REST document format: "build": { "integerValue": "29" }
            Match m2 = Regex.Match(json, "\"build\"\\s*:\\s*\\{\\s*\"(?:integerValue|doubleValue)\"\\s*:\\s*\"?(\\d+)\"?");
            if (m2.Success)
            {
                int b;
                if (int.TryParse(m2.Groups[1].Value, out b)) return b;
            }

            return 0;
        }

        private static string ExtractVersionString(string json)
        {
            if (string.IsNullOrEmpty(json)) return "";

            Match m1 = Regex.Match(json, "\"version\"\\s*:\\s*\"([^\"]+)\"");
            if (m1.Success) return m1.Groups[1].Value.Trim();

            Match m2 = Regex.Match(json, "\"version\"\\s*:\\s*\\{\\s*\"stringValue\"\\s*:\\s*\"([^\"]+)\"");
            if (m2.Success) return m2.Groups[1].Value.Trim();

            return "";
        }

        private static string ExtractJsonStringField(string json, string fieldName)
        {
            if (string.IsNullOrEmpty(json)) return "";
            Match m = Regex.Match(json, "\"" + Regex.Escape(fieldName) + "\"\\s*:\\s*\"([^\"]+)\"");
            return m.Success ? m.Groups[1].Value.Trim() : "";
        }

        private void ActivateUpdateBanner(string version, int build, string downloadUrl)
        {
            if (_shuttingDown) return;
            try
            {
                BeginInvoke((MethodInvoker)delegate
                {
                    _remoteVersion = string.IsNullOrEmpty(version) ? _remoteVersion : version;
                    if (build > _remoteBuild) _remoteBuild = build;
                    if (!string.IsNullOrEmpty(downloadUrl)) _remoteDownloadUrl = downloadUrl;
                    _updateAvailable = true;
                    Invalidate();
                });
            }
            catch { }
        }

        private void BridgeLoop()
        {
            while (!_shuttingDown)
            {
                TcpClient client = null;
                try
                {
                    client = _bridgeListener.AcceptTcpClient();
                    client.ReceiveTimeout = 4000;
                    client.SendTimeout = 4000;
                    HandleBridgeClient(client);
                }
                catch
                {
                    if (_shuttingDown) break;
                }
                finally
                {
                    if (client != null)
                    {
                        try { client.Close(); } catch { }
                    }
                }
            }
        }

        private void HandleBridgeClient(TcpClient client)
        {
            using (NetworkStream ns = client.GetStream())
            {
                byte[] buffer = new byte[16384];
                int read = ns.Read(buffer, 0, buffer.Length);
                if (read <= 0) return;

                string rawReq = Encoding.UTF8.GetString(buffer, 0, read);
                string[] lines = rawReq.Split(new[] { "\r\n" }, StringSplitOptions.None);
                if (lines.Length == 0) return;

                string[] reqParts = lines[0].Split(' ');
                if (reqParts.Length < 2) return;

                string method = reqParts[0].ToUpperInvariant();
                string path = reqParts[1];

                if (method == "OPTIONS")
                {
                    WriteHttpResponse(ns, 204, "");
                    return;
                }

                int bodyIdx = rawReq.IndexOf("\r\n\r\n", StringComparison.Ordinal);
                string body = bodyIdx >= 0 ? rawReq.Substring(bodyIdx + 4) : "";

                if (path.StartsWith("/status", StringComparison.OrdinalIgnoreCase))
                {
                    string statusJson = string.Format(
                        "{{\"ok\":true,\"version\":\"{0}\",\"build\":{1},\"updateAvailable\":{2}}}",
                        Program.CurrentVersionLabel,
                        Program.CurrentDesktopBuild,
                        _updateAvailable ? "true" : "false"
                    );
                    WriteHttpResponse(ns, 200, statusJson);
                    return;
                }

                if (path.StartsWith("/window/minimize", StringComparison.OrdinalIgnoreCase))
                {
                    IntPtr h = _mksHwnd != IntPtr.Zero ? _mksHwnd : Program.FindMksAppWindow();
                    if (h != IntPtr.Zero) NativeMethods.ShowWindow(h, NativeMethods.SW_MINIMIZE);
                    WriteHttpResponse(ns, 200, "{\"ok\":true}");
                    return;
                }

                if (path.StartsWith("/window/toggle-maximize", StringComparison.OrdinalIgnoreCase))
                {
                    IntPtr h = _mksHwnd != IntPtr.Zero ? _mksHwnd : Program.FindMksAppWindow();
                    if (h != IntPtr.Zero)
                    {
                        NativeMethods.ShowWindow(
                            h,
                            NativeMethods.IsZoomed(h) ? NativeMethods.SW_RESTORE : NativeMethods.SW_MAXIMIZE
                        );
                    }
                    WriteHttpResponse(ns, 200, "{\"ok\":true}");
                    return;
                }

                if (path.StartsWith("/window/close", StringComparison.OrdinalIgnoreCase))
                {
                    IntPtr h = _mksHwnd != IntPtr.Zero ? _mksHwnd : Program.FindMksAppWindow();
                    if (h != IntPtr.Zero) NativeMethods.PostMessage(h, NativeMethods.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                    WriteHttpResponse(ns, 200, "{\"ok\":true}");
                    return;
                }

                if (path.StartsWith("/update/notify", StringComparison.OrdinalIgnoreCase))
                {
                    int b = ExtractBuildNumber(body);
                    string v = ExtractVersionString(body);
                    string dl = ExtractJsonStringField(body, "downloadUrl");
                    if (b > GetEffectiveBaselineBuild())
                    {
                        ActivateUpdateBanner(v, b, dl);
                    }
                    WriteHttpResponse(ns, 200, "{\"ok\":true}");
                    return;
                }

                if (path.StartsWith("/update/apply", StringComparison.OrdinalIgnoreCase))
                {
                    int b = ExtractBuildNumber(body);
                    string v = ExtractVersionString(body);
                    string dl = ExtractJsonStringField(body, "downloadUrl");
                    string relaunch = ExtractJsonStringField(body, "relaunchUrl");
                    if (b > _remoteBuild) _remoteBuild = b;
                    if (!string.IsNullOrEmpty(v)) _remoteVersion = v;
                    if (!string.IsNullOrEmpty(dl)) _remoteDownloadUrl = dl;

                    WriteHttpResponse(ns, 200, "{\"ok\":true,\"updating\":true}");
                    BeginInvoke((MethodInvoker)delegate { TriggerSelfUpdate(relaunch); });
                    return;
                }

                if (path.StartsWith("/pdf/list", StringComparison.OrdinalIgnoreCase))
                {
                    List<FileInfo> pdfs = GetRecentPdfFiles(_appDataDir, 25);
                    StringBuilder sb = new StringBuilder();
                    sb.Append("{\"ok\":true,\"files\":[");
                    for (int i = 0; i < pdfs.Count; i++)
                    {
                        if (i > 0) sb.Append(",");
                        FileInfo fi = pdfs[i];
                        sb.Append("{");
                        sb.Append("\"name\":\"").Append(EscapeJson(fi.Name)).Append("\",");
                        sb.Append("\"path\":\"").Append(EscapeJson(fi.FullName)).Append("\",");
                        sb.Append("\"size\":").Append(fi.Length).Append(",");
                        sb.Append("\"date\":\"").Append(fi.LastWriteTime.ToString("dd.MM.yyyy HH:mm")).Append("\"");
                        sb.Append("}");
                    }
                    sb.Append("]}");
                    WriteHttpResponse(ns, 200, sb.ToString());
                    return;
                }

                if (path.StartsWith("/pdf/open-folder", StringComparison.OrdinalIgnoreCase))
                {
                    OpenPdfFolder(_appDataDir);
                    WriteHttpResponse(ns, 200, "{\"ok\":true}");
                    return;
                }

                if (path.StartsWith("/pdf/open", StringComparison.OrdinalIgnoreCase))
                {
                    string targetPath = ExtractQueryParam(path, "path");
                    if (string.IsNullOrEmpty(targetPath))
                    {
                        targetPath = GetMostRecentPdfPath(_appDataDir);
                    }
                    if (!string.IsNullOrEmpty(targetPath) && File.Exists(targetPath))
                    {
                        try { Process.Start(new ProcessStartInfo { FileName = targetPath, UseShellExecute = true }); } catch { }
                        WriteHttpResponse(ns, 200, "{\"ok\":true}");
                    }
                    else
                    {
                        WriteHttpResponse(ns, 404, "{\"ok\":false,\"error\":\"Dosya bulunamadı\"}");
                    }
                    return;
                }

                if (path.StartsWith("/pdf/print-current", StringComparison.OrdinalIgnoreCase))
                {
                    TriggerPrintCurrentPage(_mksHwnd);
                    WriteHttpResponse(ns, 200, "{\"ok\":true}");
                    return;
                }

                if (path.StartsWith("/pdf/print", StringComparison.OrdinalIgnoreCase))
                {
                    string targetPath = ExtractQueryParam(path, "path");
                    if (string.IsNullOrEmpty(targetPath))
                    {
                        targetPath = GetMostRecentPdfPath(_appDataDir);
                    }
                    if (!string.IsNullOrEmpty(targetPath) && File.Exists(targetPath))
                    {
                        bool success = PrintPdfFile(targetPath);
                        WriteHttpResponse(ns, 200, string.Format("{{\"ok\":{0}}}", success ? "true" : "false"));
                    }
                    else
                    {
                        TriggerPrintCurrentPage(_mksHwnd);
                        WriteHttpResponse(ns, 200, "{\"ok\":true,\"fallback\":\"print-current\"}");
                    }
                    return;
                }

                WriteHttpResponse(ns, 404, "{\"ok\":false}");
            }
        }

        private static void WriteHttpResponse(NetworkStream ns, int statusCode, string jsonBody)
        {
            byte[] bodyBytes = Encoding.UTF8.GetBytes(jsonBody ?? "");
            string statusText = statusCode == 204 ? "No Content" : (statusCode == 200 ? "OK" : "Not Found");
            string headers =
                "HTTP/1.1 " + statusCode + " " + statusText + "\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type\r\n" +
                "Access-Control-Allow-Private-Network: true\r\n" +
                "Cache-Control: no-store\r\n" +
                "Content-Length: " + bodyBytes.Length + "\r\n" +
                "Connection: close\r\n\r\n";

            byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
            ns.Write(headerBytes, 0, headerBytes.Length);
            if (bodyBytes.Length > 0)
            {
                ns.Write(bodyBytes, 0, bodyBytes.Length);
            }
            ns.Flush();
        }

        private void TriggerSelfUpdate(string customRelaunchUrl)
        {
            if (_isUpdating) return;
            _isUpdating = true;
            Invalidate();

            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    int targetBuild = Math.Max(_remoteBuild, Program.CurrentDesktopBuild);
                    try
                    {
                        File.WriteAllText(Path.Combine(_appDataDir, "ack_build.txt"), targetBuild.ToString());
                    }
                    catch { }

                    string downloadUrl = !string.IsNullOrEmpty(_remoteDownloadUrl)
                        ? _remoteDownloadUrl
                        : (_activeOrigin + "/downloads/MKS_Masaustu_Kurulum.exe");

                    string sep = downloadUrl.Contains("?") ? "&" : "?";
                    string bustedExeUrl = downloadUrl + sep + "t=" + DateTime.UtcNow.Ticks;
                    string stagedExe = Path.Combine(_appDataDir, "MKS_Masaustu_Update.exe");
                    string installedExe = Path.Combine(_appDataDir, "MKS_Masaustu.exe");

                    bool downloadedValidExe = false;
                    try
                    {
                        using (WebClient wc = new WebClient())
                        {
                            byte[] data = wc.DownloadData(bustedExeUrl);
                            if (data != null && data.Length > 20480 && data[0] == 0x4D && data[1] == 0x5A)
                            {
                                File.WriteAllBytes(stagedExe, data);
                                downloadedValidExe = true;
                            }
                        }
                    }
                    catch
                    {
                        downloadedValidExe = false;
                    }

                    string nextUrl = !string.IsNullOrEmpty(customRelaunchUrl)
                        ? customRelaunchUrl
                        : string.Format("{0}/?platform=desktop&v={1}&t={2}", _activeOrigin, targetBuild, DateTime.UtcNow.Ticks);

                    // Mevcut uygulama penceresini güvenli şekilde kapat (IndexedDB & oturum korunur)
                    IntPtr h = _mksHwnd != IntPtr.Zero ? _mksHwnd : Program.FindMksAppWindow();
                    if (h != IntPtr.Zero)
                    {
                        NativeMethods.PostMessage(h, NativeMethods.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);
                    }

                    string updaterCmd = Path.Combine(_appDataDir, "mks_apply_update.cmd");
                    StringBuilder sb = new StringBuilder();
                    sb.AppendLine("@echo off");
                    sb.AppendLine("ping 127.0.0.1 -n 2 > nul");
                    if (downloadedValidExe)
                    {
                        sb.AppendFormat("copy /y \"{0}\" \"{1}\" > nul\r\n", stagedExe, installedExe);
                        sb.AppendFormat("del /f /q \"{0}\" > nul 2>&1\r\n", stagedExe);
                    }
                    string exeToRun = File.Exists(installedExe) ? installedExe : Application.ExecutablePath;
                    sb.AppendFormat("start \"\" \"{0}\" --just-updated --relaunch-url=\"{1}\"\r\n", exeToRun, nextUrl);
                    File.WriteAllText(updaterCmd, sb.ToString(), Encoding.Default);

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = "/c \"" + updaterCmd + "\"",
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process.Start(psi);

                    BeginInvoke((MethodInvoker)ShutdownCleanly);
                }
                catch
                {
                    BeginInvoke((MethodInvoker)delegate
                    {
                        _isUpdating = false;
                        Invalidate();
                    });
                }
            });
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }

        private static string ExtractQueryParam(string url, string key)
        {
            try
            {
                int qIdx = url.IndexOf('?');
                if (qIdx < 0) return "";
                string query = url.Substring(qIdx + 1);
                string[] pairs = query.Split('&');
                foreach (string p in pairs)
                {
                    string[] kv = p.Split('=');
                    if (kv.Length == 2 && string.Equals(kv[0], key, StringComparison.OrdinalIgnoreCase))
                    {
                        return Uri.UnescapeDataString(kv[1]);
                    }
                }
            }
            catch { }
            return "";
        }

        private void ShutdownCleanly()
        {
            if (_shuttingDown) return;
            _shuttingDown = true;
            try { _geometryTimer.Stop(); } catch { }
            try { _versionPollTimer.Stop(); } catch { }
            try { if (_bridgeListener != null) _bridgeListener.Stop(); } catch { }
            Application.Exit();
        }
    }

    internal sealed class PdfQuickAccessPopupForm : Form
    {
        private readonly string _appDataDir;
        private readonly IntPtr _mksHwnd;
        private Panel _listPanel;

        public PdfQuickAccessPopupForm(string appDataDir, IntPtr mksHwnd)
        {
            _appDataDir = appDataDir;
            _mksHwnd = mksHwnd;

            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            Width = 480;
            Height = 460;
            BackColor = Color.FromArgb(15, 23, 42); // Slate 900
            DoubleBuffered = true;

            KeyPreview = true;
            KeyDown += delegate(object s, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Escape)
                {
                    Hide();
                }
            };

            Deactivate += delegate { Hide(); };

            BuildUi();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (Pen p = new Pen(Color.FromArgb(51, 65, 85), 1.5f))
            {
                e.Graphics.DrawRectangle(p, 0, 0, Width - 1, Height - 1);
            }
        }

        private void BuildUi()
        {
            Controls.Clear();

            // Header (50px)
            Panel header = new Panel
            {
                Dock = DockStyle.Top,
                Height = 50,
                BackColor = Color.FromArgb(30, 41, 59)
            };

            Label title = new Label
            {
                Text = "PDF Belgeleri ve Yazıcı",
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = false,
                Location = new Point(14, 14),
                Size = new Size(210, 24)
            };
            header.Controls.Add(title);

            Button btnPrinters = new Button
            {
                Text = "Yazıcılar",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(203, 213, 225),
                BackColor = Color.FromArgb(51, 65, 85),
                FlatStyle = FlatStyle.Flat,
                Size = new Size(80, 28),
                Location = new Point(230, 11),
                Cursor = Cursors.Hand
            };
            btnPrinters.FlatAppearance.BorderSize = 0;
            btnPrinters.Click += delegate
            {
                try { Process.Start("ms-settings:printers"); } catch { }
            };
            header.Controls.Add(btnPrinters);

            Button btnFolder = new Button
            {
                Text = "Klasör",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(203, 213, 225),
                BackColor = Color.FromArgb(51, 65, 85),
                FlatStyle = FlatStyle.Flat,
                Size = new Size(76, 28),
                Location = new Point(318, 11),
                Cursor = Cursors.Hand
            };
            btnFolder.FlatAppearance.BorderSize = 0;
            btnFolder.Click += delegate
            {
                TitlebarUpdateOverlayForm.OpenPdfFolder(_appDataDir);
                Hide();
            };
            header.Controls.Add(btnFolder);

            Button btnClose = new Button
            {
                Text = "X",
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                ForeColor = Color.FromArgb(148, 163, 184),
                BackColor = Color.Transparent,
                FlatStyle = FlatStyle.Flat,
                Size = new Size(32, 28),
                Location = new Point(438, 11),
                Cursor = Cursors.Hand
            };
            btnClose.FlatAppearance.BorderSize = 0;
            btnClose.Click += delegate { Hide(); };
            header.Controls.Add(btnClose);

            Controls.Add(header);

            // Bottom action bar (54px)
            Panel bottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 54,
                BackColor = Color.FromArgb(30, 41, 59)
            };

            Button btnPrintCurrent = new Button
            {
                Text = "Ekrandaki Sayfayı / Faturayı Yazdır (Ctrl+P)",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(16, 185, 129),
                FlatStyle = FlatStyle.Flat,
                Dock = DockStyle.Fill,
                Cursor = Cursors.Hand
            };
            btnPrintCurrent.FlatAppearance.BorderSize = 0;
            btnPrintCurrent.Click += delegate
            {
                Hide();
                TitlebarUpdateOverlayForm.TriggerPrintCurrentPage(_mksHwnd);
            };
            bottom.Controls.Add(btnPrintCurrent);

            Controls.Add(bottom);

            // Content list panel
            _listPanel = new Panel
            {
                Dock = DockStyle.Fill,
                AutoScroll = true,
                BackColor = Color.FromArgb(15, 23, 42)
            };
            Controls.Add(_listPanel);
            _listPanel.BringToFront();
        }

        public void RefreshFiles()
        {
            if (_listPanel == null) return;
            _listPanel.Controls.Clear();

            List<FileInfo> pdfs = TitlebarUpdateOverlayForm.GetRecentPdfFiles(_appDataDir, 25);

            if (pdfs.Count == 0)
            {
                Label empty = new Label
                {
                    Text = "Henüz indirilmiş PDF dosyası bulunamadı.\n\nİndirilen faturalar, defterler ve reçeteler\nburada anında görünecektir.",
                    Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                    ForeColor = Color.FromArgb(148, 163, 184),
                    TextAlign = ContentAlignment.MiddleCenter,
                    Dock = DockStyle.Fill
                };
                _listPanel.Controls.Add(empty);
                return;
            }

            int top = 8;
            for (int i = 0; i < pdfs.Count; i++)
            {
                FileInfo fi = pdfs[i];
                Panel item = CreatePdfItemRow(fi, i);
                item.Location = new Point(8, top);
                item.Width = _listPanel.ClientSize.Width - 16;
                item.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
                _listPanel.Controls.Add(item);
                top += item.Height + 6;
            }
        }

        private Panel CreatePdfItemRow(FileInfo fi, int index)
        {
            Panel p = new Panel
            {
                Height = 60,
                BackColor = Color.FromArgb(30, 41, 59)
            };

            Label badge = new Label
            {
                Text = "PDF",
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(220, 38, 38),
                TextAlign = ContentAlignment.MiddleCenter,
                Size = new Size(36, 26),
                Location = new Point(10, 17)
            };
            p.Controls.Add(badge);

            string name = fi.Name;
            if (name.Length > 34) name = name.Substring(0, 31) + "...";

            Label lblName = new Label
            {
                Text = name,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = false,
                Size = new Size(220, 20),
                Location = new Point(52, 10),
                Cursor = Cursors.Hand
            };
            lblName.Click += delegate
            {
                try { Process.Start(new ProcessStartInfo { FileName = fi.FullName, UseShellExecute = true }); } catch { }
                Hide();
            };
            p.Controls.Add(lblName);

            long sizeKb = Math.Max(1, fi.Length / 1024);
            Label lblMeta = new Label
            {
                Text = fi.LastWriteTime.ToString("dd.MM.yyyy HH:mm") + "  •  " + sizeKb + " KB",
                Font = new Font("Segoe UI", 8.2f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                AutoSize = false,
                Size = new Size(220, 18),
                Location = new Point(52, 32)
            };
            p.Controls.Add(lblMeta);

            // [Aç]
            Button btnOpen = new Button
            {
                Text = "Aç",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(59, 130, 246),
                FlatStyle = FlatStyle.Flat,
                Size = new Size(40, 28),
                Location = new Point(282, 16),
                Cursor = Cursors.Hand
            };
            btnOpen.FlatAppearance.BorderSize = 0;
            btnOpen.Click += delegate
            {
                try { Process.Start(new ProcessStartInfo { FileName = fi.FullName, UseShellExecute = true }); } catch { }
                Hide();
            };
            p.Controls.Add(btnOpen);

            // [Yazdır]
            Button btnPrint = new Button
            {
                Text = "Yazdır",
                Font = new Font("Segoe UI", 8f, FontStyle.Regular),
                ForeColor = Color.White,
                BackColor = Color.FromArgb(16, 185, 129),
                FlatStyle = FlatStyle.Flat,
                Size = new Size(54, 28),
                Location = new Point(328, 16),
                Cursor = Cursors.Hand
            };
            btnPrint.FlatAppearance.BorderSize = 0;
            btnPrint.Click += delegate
            {
                TitlebarUpdateOverlayForm.PrintPdfFile(fi.FullName);
                Hide();
            };
            p.Controls.Add(btnPrint);

            // [Klasör]
            Button btnFolder = new Button
            {
                Text = "Konum",
                Font = new Font("Segoe UI", 8f, FontStyle.Regular),
                ForeColor = Color.FromArgb(203, 213, 225),
                BackColor = Color.FromArgb(71, 85, 105),
                FlatStyle = FlatStyle.Flat,
                Size = new Size(58, 28),
                Location = new Point(388, 16),
                Cursor = Cursors.Hand
            };
            btnFolder.FlatAppearance.BorderSize = 0;
            btnFolder.Click += delegate
            {
                try { Process.Start("explorer.exe", "/select,\"" + fi.FullName + "\""); } catch { }
                Hide();
            };
            p.Controls.Add(btnFolder);

            return p;
        }
    }

    internal static class Program
    {
        public const string CurrentVersionLabel = "8.2.1";
        public const int CurrentDesktopBuild = 29;

        private const string DefaultCloudOrigin = "https://muhendiskayitsistemi.com";
        private const string LocalStandaloneOrigin = "http://127.0.0.1:3000";
        public const string FirestoreReleaseDocUrl =
            "https://firestore.googleapis.com/v1/projects/muhendiskayitsistemi/databases/(default)/documents/MKS/g892bEaJyGfEq1Fa67yb/system_settings/release_version";

        [STAThread]
        private static void Main(string[] args)
        {
            try
            {
                NativeMethods.SetProcessDPIAware();
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | (SecurityProtocolType)3072;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool justUpdated = false;
                string relaunchOverrideUrl = null;
                if (args != null)
                {
                    foreach (string a in args)
                    {
                        if (string.Equals(a, "--just-updated", StringComparison.OrdinalIgnoreCase))
                        {
                            justUpdated = true;
                        }
                        else if (a != null && a.StartsWith("--relaunch-url=", StringComparison.OrdinalIgnoreCase))
                        {
                            relaunchOverrideUrl = a.Substring("--relaunch-url=".Length).Trim('"');
                        }
                    }
                }

                string appDataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "MKS"
                );
                Directory.CreateDirectory(appDataDir);

                string installedExePath = EnsureInstalledBinary(appDataDir);
                EnsureShortcuts(installedExePath);

                bool createdNew;
                using (Mutex singleInstanceMutex = new Mutex(true, "Local\\MKS_Desktop_Supervisor_v82", out createdNew))
                {
                    if (!createdNew)
                    {
                        if (justUpdated)
                        {
                            try { createdNew = singleInstanceMutex.WaitOne(3500, false); } catch { createdNew = true; }
                        }
                        if (!createdNew)
                        {
                            IntPtr existingHwnd = FindMksAppWindow();
                            if (existingHwnd != IntPtr.Zero)
                            {
                                if (NativeMethods.IsIconic(existingHwnd))
                                {
                                    NativeMethods.ShowWindow(existingHwnd, NativeMethods.SW_RESTORE);
                                }
                                NativeMethods.SetForegroundWindow(existingHwnd);
                                return;
                            }
                        }
                    }

                    TcpListener bridgeListener = new TcpListener(IPAddress.Loopback, 0);
                    bridgeListener.Start();
                    int bridgePort = ((IPEndPoint)bridgeListener.LocalEndpoint).Port;

                    string activeOrigin = ResolveActiveOrigin(appDataDir);
                    string launchUrl = BuildDesktopLaunchUrl(activeOrigin, relaunchOverrideUrl, bridgePort);

                    LaunchAppWindow(launchUrl, appDataDir);

                    TitlebarUpdateOverlayForm supervisorForm = new TitlebarUpdateOverlayForm(
                        appDataDir,
                        activeOrigin,
                        bridgePort,
                        bridgeListener
                    );
                    Application.Run(supervisorForm);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "MKS Masaüstü başlatılırken bir hata oluştu:\n" + ex.Message,
                    "MKS Mühendis Kayıt Sistemi",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        public static IntPtr FindMksAppWindow()
        {
            IntPtr found = IntPtr.Zero;
            NativeMethods.EnumWindows((hWnd, lParam) =>
            {
                if (!NativeMethods.IsWindowVisible(hWnd)) return true;

                StringBuilder cls = new StringBuilder(128);
                NativeMethods.GetClassName(hWnd, cls, cls.Capacity);
                string className = cls.ToString();
                if (!className.StartsWith("Chrome_WidgetWin", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                StringBuilder sb = new StringBuilder(256);
                NativeMethods.GetWindowText(hWnd, sb, sb.Capacity);
                string title = sb.ToString();
                if (string.IsNullOrEmpty(title)) return true;

                if (title.IndexOf("Mühendis Kayıt Sistemi", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    title.IndexOf("MKS —", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    title.StartsWith("MKS ", StringComparison.OrdinalIgnoreCase))
                {
                    // Normal tarayıcı sekmelerini (" - Microsoft Edge" / " - Google Chrome" uzantılı çoklu sekme penceresini) ayırmak için kontrol:
                    // --app modunda başlık doğrudan sayfa başlığıdır.
                    found = hWnd;
                    return false;
                }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        private static string BuildDesktopLaunchUrl(string activeOrigin, string relaunchOverrideUrl, int bridgePort)
        {
            string baseTarget = !string.IsNullOrEmpty(relaunchOverrideUrl)
                ? relaunchOverrideUrl
                : (activeOrigin.TrimEnd('/') + "/?platform=desktop");

            string sep = baseTarget.Contains("?") ? "&" : "?";
            if (baseTarget.IndexOf("platform=desktop", StringComparison.OrdinalIgnoreCase) < 0)
            {
                baseTarget = baseTarget + sep + "platform=desktop";
                sep = "&";
            }

            return string.Format(
                "{0}{1}nativeShell=1&desktopBuild={2}&bridgePort={3}",
                baseTarget,
                sep,
                CurrentDesktopBuild,
                bridgePort
            );
        }

        private static string EnsureInstalledBinary(string appDataDir)
        {
            string currentExe = Application.ExecutablePath;
            string installedExe = Path.Combine(appDataDir, "MKS_Masaustu.exe");
            try
            {
                if (!string.Equals(Path.GetFullPath(currentExe), Path.GetFullPath(installedExe), StringComparison.OrdinalIgnoreCase))
                {
                    File.Copy(currentExe, installedExe, true);
                }
                return installedExe;
            }
            catch
            {
                return currentExe;
            }
        }

        private static void EnsureShortcuts(string targetExePath)
        {
            try
            {
                string desktopShortcut = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                    "MKS Mühendis Kayıt Sistemi.lnk"
                );
                string startMenuShortcut = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                    "MKS Mühendis Kayıt Sistemi.lnk"
                );

                CreateShortcutIfMissing(desktopShortcut, targetExePath);
                CreateShortcutIfMissing(startMenuShortcut, targetExePath);
            }
            catch { }
        }

        private static void CreateShortcutIfMissing(string shortcutPath, string targetExePath)
        {
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;
            object shell = Activator.CreateInstance(shellType);
            object shortcut = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcutPath });
            if (shortcut == null) return;

            Type scType = shortcut.GetType();
            scType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, shortcut, new object[] { targetExePath });
            scType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, shortcut, new object[] { Path.GetDirectoryName(targetExePath) ?? "" });
            scType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, shortcut, new object[] { targetExePath + ",0" });
            scType.InvokeMember("Description", BindingFlags.SetProperty, null, shortcut, new object[] { "MKS Mühendis Kayıt Sistemi" });
            scType.InvokeMember("Save", BindingFlags.InvokeMethod, null, shortcut, null);
        }

        private static string ResolveActiveOrigin(string appDataDir)
        {
            string localConfig = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "mks_server.txt");
            string userConfig = Path.Combine(appDataDir, "mks_server.txt");

            foreach (string cfg in new[] { localConfig, userConfig })
            {
                if (File.Exists(cfg))
                {
                    string custom = (File.ReadAllText(cfg) ?? "").Trim();
                    if (custom.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                        custom.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            Uri u = new Uri(custom);
                            return u.GetLeftPart(UriPartial.Authority);
                        }
                        catch
                        {
                            return custom.TrimEnd('/');
                        }
                    }
                }
            }

            if (IsLocalMksServerListening("127.0.0.1", 3000, 400))
            {
                return LocalStandaloneOrigin;
            }

            return DefaultCloudOrigin;
        }

        private static bool IsLocalMksServerListening(string host, int port, int timeoutMs)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(timeoutMs));
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void LaunchAppWindow(string url, string appDataDir)
        {
            string profileDir = Path.Combine(appDataDir, "WebProfile");
            Directory.CreateDirectory(profileDir);

            string[] browserCandidates = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string browserPath in browserCandidates)
            {
                if (!string.IsNullOrEmpty(browserPath) && File.Exists(browserPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = browserPath,
                        Arguments = string.Format("--app=\"{0}\" --start-maximized --user-data-dir=\"{1}\"", url, profileDir),
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                    return;
                }
            }

            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }
    }
}
