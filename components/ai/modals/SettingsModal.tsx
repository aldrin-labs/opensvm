import { X } from 'lucide-react';
import { useSettings } from '../../../lib/ai/hooks/useSettings';
import { useUIPreferences } from '../hooks/useUIPreferences';
import { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { prefs, update } = useUIPreferences();
  const [localSettings, setLocalSettings] = useState(settings);

  // Update local settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  const handleReset = () => {
    resetSettings();
    setLocalSettings(settings);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        try { window.dispatchEvent(new CustomEvent('svmai:event', { detail: { type: 'settings_close', ts: Date.now() } })); } catch { }
      } else if (e.key === 'Tab') {
        const root = document.querySelector('[data-ai-settings-modal]') as HTMLElement | null;
        if (!root) return;
        const focusables = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.hasAttribute('disabled'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50" data-ai-settings-modal>
      <div className="relative w-full max-w-lg bg-black border border-white/20 rounded-lg shadow-xl" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <h2 className="text-lg font-medium text-white">Settings</h2>
          <button
            onClick={handleCancel}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-sm transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* RPC Endpoint */}
          <div className="space-y-2">
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">Theme</label>
            <select
              value={localSettings.theme}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, theme: e.target.value as 'dark' | 'light' | 'system' }))}
              className="w-full bg-black text-white text-sm px-3 py-2 rounded-lg border border-white/20 focus:outline-none focus:border-white/40"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          {/* Auto-clear */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-white">Auto-clear chat history</label>
              <p className="text-xs text-white/50">Automatically clear chat history when closing</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoClear}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, autoClear: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Model Settings */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white">Model Settings</label>
            <div className="space-y-4 p-3 rounded-lg border border-white/20">
              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/70">Temperature</label>
                  <span className="text-sm text-white/70">{localSettings.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localSettings.temperature}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Max Tokens */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white/70">Max Tokens</label>
                  <span className="text-sm text-white/70">{localSettings.maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="256"
                  max="4096"
                  step="256"
                  value={localSettings.maxTokens}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="space-y-4 border border-white/20 rounded-lg p-3" data-ai-appearance-group>
            <h3 className="text-sm font-semibold text-white">Appearance</h3>
            {/* Density */}
            <fieldset className="space-y-1" data-ai-pref-density>
              <legend className="text-xs uppercase tracking-wide text-white/50">Density</legend>
              <div className="flex gap-3 text-sm">
                {(['comfortable', 'compact'] as const).map(opt => (
                  <label key={opt} className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="density"
                      value={opt}
                      checked={prefs.density === opt}
                      onChange={() => update('density', opt)}
                    />
                    <span className="capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {/* Font Size */}
            <div className="space-y-1" data-ai-pref-font-size>
              <label className="text-xs uppercase tracking-wide text-white/50">Font Size</label>
              <select
                className="bg-black border border-white/20 rounded px-2 py-1 text-sm"
                value={prefs.fontSize}
                onChange={(e) => update('fontSize', Number(e.target.value) as any)}
              >
                {[12, 13, 14].map(s => <option key={s} value={s}>{s}px</option>)}
              </select>
            </div>
            {/* Role Labels */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.showRoleLabels}
                onChange={e => update('showRoleLabels', e.target.checked)}
              />
              <span>Show role labels</span>
            </label>
            {/* Reasoning Default */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={prefs.showReasoningDefault}
                onChange={e => update('showReasoningDefault', e.target.checked)}
              />
              <span>Show reasoning by default</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/20">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-black bg-white hover:bg-white/90 rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}