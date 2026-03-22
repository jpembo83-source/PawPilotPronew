import React, { useState, useEffect, useRef } from 'react';
import { Save, AlertTriangle, History, Upload, X, Image } from 'lucide-react';
import { useSettingsStore, OrganisationSettings as OrgSettingsType } from '../store';
import { toast } from 'sonner';

// Reusable components for the settings UI

function SettingCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-6 shadow-sm">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-lg font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <div className="p-6 space-y-6">
        {children}
      </div>
    </div>
  );
}

function InputField({ label, id, value, onChange, type = "text", help }: { label: string; id: string; value: string | number; onChange: (val: string) => void; type?: string; help?: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
      />
      {help && <p className="mt-1 text-xs text-slate-500">{help}</p>}
    </div>
  );
}

function ColorPicker({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (val: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md border border-slate-300 overflow-hidden shrink-0">
          <input
            type="color"
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm uppercase font-mono"
        />
      </div>
    </div>
  );
}

export function OrganisationSettings() {
  const { organisation, updateOrganisation, logAction } = useSettingsStore();
  const [formData, setFormData] = useState<OrgSettingsType>(organisation);
  const [isDirty, setIsDirty] = useState(false);

  // Sync with store when it changes (or on mount)
  useEffect(() => {
    setFormData(organisation);
  }, [organisation]);

  const handleChange = (field: keyof OrgSettingsType, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      setIsDirty(JSON.stringify(newData) !== JSON.stringify(organisation));
      return newData;
    });
  };

  const handleSave = () => {
    // Audit differences
    const changes: string[] = [];
    (Object.keys(formData) as Array<keyof OrgSettingsType>).forEach(key => {
      if (formData[key] !== organisation[key]) {
        changes.push(`${key}: ${organisation[key]} -> ${formData[key]}`);
      }
    });

    if (changes.length > 0) {
      updateOrganisation(formData);
      logAction('UPDATE_ORGANISATION', `Updated: ${changes.join(', ')}`, 'Admin User'); // In real app, get user from AuthContext
      toast.success('Organisation settings saved');
      setIsDirty(false);
    }
  };

  const handleReset = () => {
    setFormData(organisation);
    setIsDirty(false);
    toast.info('Changes discarded');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Organisation Profile</h2>
          <p className="text-sm text-slate-500">Manage your legal entity and brand identity.</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-200">
            <span className="text-sm text-amber-600 font-medium flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              Unsaved Changes
            </span>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md shadow-sm transition-colors"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </button>
          </div>
        )}
      </div>

      <SettingCard title="Legal Identity" description="Your business registration details used on invoices and contracts.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Legal Entity Name"
            id="name"
            value={formData.name}
            onChange={(val) => handleChange('name', val)}
            help="Registered company name."
          />
          <InputField
            label="Trading Name"
            id="tradingName"
            value={formData.tradingName}
            onChange={(val) => handleChange('tradingName', val)}
            help="Name displayed to customers."
          />
          <div className="md:col-span-2">
            <InputField
              label="Registered Address"
              id="address"
              value={formData.address}
              onChange={(val) => handleChange('address', val)}
              help="Primary business location."
            />
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Localization" description="Regional settings for date, time, and language.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => handleChange('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm bg-white"
            >
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Paris">Paris (CET/CEST)</option>
              <option value="America/New_York">New York (EST/EDT)</option>
              <option value="America/Chicago">Chicago (CST/CDT)</option>
              <option value="America/Denver">Denver (MST/MDT)</option>
              <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Asia/Singapore">Singapore (SGT)</option>
              <option value="Asia/Dubai">Dubai (GST)</option>
              <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">System operations will align to this timezone.</p>
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
            <select
              value={formData.language}
              onChange={(e) => handleChange('language', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm bg-white"
            >
              <option value="en-GB">English (UK)</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm bg-white"
            >
              <option value="GBP">British Pound (GBP)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="AUD">Australian Dollar (AUD)</option>
              <option value="CAD">Canadian Dollar (CAD)</option>
              <option value="NZD">New Zealand Dollar (NZD)</option>
              <option value="JPY">Japanese Yen (JPY)</option>
              <option value="CHF">Swiss Franc (CHF)</option>
              <option value="SGD">Singapore Dollar (SGD)</option>
              <option value="AED">UAE Dirham (AED)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Currency for pricing and invoices.</p>
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Dial Code</label>
            <select
              value={formData.dialCode}
              onChange={(e) => handleChange('dialCode', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm bg-white"
            >
              <option value="+44">United Kingdom (+44)</option>
              <option value="+1">United States / Canada (+1)</option>
              <option value="+33">France (+33)</option>
              <option value="+49">Germany (+49)</option>
              <option value="+34">Spain (+34)</option>
              <option value="+39">Italy (+39)</option>
              <option value="+41">Switzerland (+41)</option>
              <option value="+61">Australia (+61)</option>
              <option value="+64">New Zealand (+64)</option>
              <option value="+81">Japan (+81)</option>
              <option value="+86">China (+86)</option>
              <option value="+91">India (+91)</option>
              <option value="+65">Singapore (+65)</option>
              <option value="+971">United Arab Emirates (+971)</option>
              <option value="+27">South Africa (+27)</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Default country dial code for phone numbers.</p>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Brand Configuration" description="Customize how the platform looks to your staff and customers.">
        <div className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Organisation Logo</label>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden">
                {formData.logoUrl ? (
                  <img 
                    src={formData.logoUrl} 
                    alt="Organisation logo" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Image className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors">
                    <Upload className="h-4 w-4" />
                    Upload Logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            handleChange('logoUrl', reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => handleChange('logoUrl', '')}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Recommended: Square image, at least 200x200px. PNG or SVG preferred.
                </p>
                <p className="text-xs text-slate-500">
                  This logo appears in the sidebar and on customer-facing documents.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ColorPicker
              label="Primary Brand Color"
              id="primaryColor"
              value={formData.primaryColor}
              onChange={(val) => handleChange('primaryColor', val)}
            />
            <ColorPicker
              label="Secondary/Accent Color"
              id="secondaryColor"
              value={formData.secondaryColor}
              onChange={(val) => handleChange('secondaryColor', val)}
            />
            <div className="md:col-span-2">
              <InputField
                label="Email Sender Name"
                id="emailSenderName"
                value={formData.emailSenderName}
                onChange={(val) => handleChange('emailSenderName', val)}
                help="Name that appears in the 'From' field of automated emails."
              />
            </div>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Global Operational Defaults" description="Baseline rules applied to all new locations.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <InputField
            label="Default Operating Hours"
            id="defaultHours"
            value={formData.defaultOperatingHours}
            onChange={(val) => handleChange('defaultOperatingHours', val)}
            help="e.g. 07:00 - 19:00"
          />
           <InputField
            label="Cancellation Policy"
            id="cancellationRule"
            value={formData.cancellationRule}
            onChange={(val) => handleChange('cancellationRule', val)}
            help="Notice period required (e.g. 24h, 48h)."
          />
           <div>
            <label htmlFor="vaccinationGrace" className="block text-sm font-medium text-slate-700 mb-1">Vaccination Grace Period</label>
            <div className="relative rounded-md shadow-sm">
              <input
                type="number"
                id="vaccinationGrace"
                value={formData.vaccinationGracePeriodDays}
                onChange={(e) => handleChange('vaccinationGracePeriodDays', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-primary focus:border-primary text-sm pr-12"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-500 sm:text-sm">days</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">Days allowed after expiry before blocking.</p>
          </div>
        </div>
      </SettingCard>
      
      <div className="flex justify-end pt-4">
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <History className="h-3 w-3" />
          Last audited change: 2 days ago by Sarah Admin
        </div>
      </div>
    </div>
  );
}