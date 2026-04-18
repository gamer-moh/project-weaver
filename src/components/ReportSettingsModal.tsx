import { useRef, useState } from 'react';
import { Building2, Calendar, ImageUp, Trash2, Type, X } from 'lucide-react';
import type { ReportSettings } from '@/hooks/use-project';

interface ReportSettingsModalProps {
  settings: ReportSettings;
  onSave: (settings: ReportSettings) => void;
  onClose: () => void;
}

export function ReportSettingsModal({ settings, onSave, onClose }: ReportSettingsModalProps) {
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [reportDate, setReportDate] = useState(settings.reportDate);
  const [ganttSubtitle, setGanttSubtitle] = useState(settings.ganttSubtitle ?? '');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(settings.logoDataUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الشعار يجب ألا يتجاوز 2 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    onSave({
      companyName: companyName.trim(),
      reportDate: reportDate.trim(),
      ganttSubtitle: ganttSubtitle.trim(),
      logoDataUrl,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        dir="rtl"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">إعدادات تقرير PDF</h2>
          <button onClick={onClose} className="p-1 text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              اسم الشركة
            </label>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="مثال: شركة الإنشاءات المتقدمة"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">يظهر تحت اسم المشروع في ترويسة التقرير.</p>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              التاريخ / النص العلوي
            </label>
            <input
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              placeholder="مثال: ١٨ أبريل ٢٠٢٦ • النسخة الأولى"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground">نص حر — اكتب التاريخ أو رقم الإصدار أو الفترة.</p>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ImageUp className="h-3.5 w-3.5 text-primary" />
              شعار الشركة (اختياري)
            </label>
            <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-secondary/20 p-3">
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="logo preview" className="h-12 w-12 rounded-md object-contain bg-white p-1" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                  <ImageUp className="h-5 w-5" />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {logoDataUrl ? 'تغيير الشعار' : 'رفع شعار'}
                </button>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl(null)}
                    className="flex items-center gap-1 text-[11px] text-destructive hover:underline"
                  >
                    <Trash2 className="h-3 w-3" /> إزالة الشعار
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  event.target.value = '';
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">PNG / JPG / SVG — حتى 2MB.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/20 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            حفظ الإعدادات
          </button>
        </div>
      </div>
    </div>
  );
}
