'use client';

import { useEffect, useMemo, useState } from 'react';
import { applyCalibrationProfileToConfig } from '@/lib/documentTemplateDesigner';
import type {
  DocumentTemplateCalibrationProfile,
  DocumentTemplateConfig,
} from '@/lib/documentTemplateTypes';

export type CalibrationProfilesPanelProps = {
  config: DocumentTemplateConfig;
  readOnly: boolean;
  onChange: (config: DocumentTemplateConfig) => void;
  onTestPrint: (profileId?: string) => void;
};

type ProfileForm = {
  profile_name: string;
  paper_label: string;
  width_mm: string;
  height_mm: string;
  top_offset_mm: string;
  left_offset_mm: string;
  print_scale: string;
  notes: string;
};

function profileIdFromName(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'calibration'}-${Date.now().toString(36)}`;
}

function numberText(value: number) {
  return Number.isFinite(value) ? String(value) : '';
}

function profileToForm(profile: DocumentTemplateCalibrationProfile): ProfileForm {
  return {
    profile_name: profile.profile_name,
    paper_label: profile.paper_label,
    width_mm: numberText(profile.width_mm),
    height_mm: numberText(profile.height_mm),
    top_offset_mm: numberText(profile.top_offset_mm),
    left_offset_mm: numberText(profile.left_offset_mm),
    print_scale: numberText(profile.print_scale),
    notes: profile.notes || '',
  };
}

function paperToForm(config: DocumentTemplateConfig): ProfileForm {
  return {
    profile_name: '',
    paper_label: `${config.paper.width_mm} x ${config.paper.height_mm} mm`,
    width_mm: numberText(config.paper.width_mm),
    height_mm: numberText(config.paper.height_mm),
    top_offset_mm: numberText(config.paper.top_offset_mm),
    left_offset_mm: numberText(config.paper.left_offset_mm),
    print_scale: numberText(config.paper.print_scale),
    notes: '',
  };
}

function parsedNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formToProfile(form: ProfileForm, profileId: string): DocumentTemplateCalibrationProfile | null {
  const width = parsedNumber(form.width_mm);
  const height = parsedNumber(form.height_mm);
  const topOffset = parsedNumber(form.top_offset_mm);
  const leftOffset = parsedNumber(form.left_offset_mm);
  const printScale = parsedNumber(form.print_scale);
  const profileName = form.profile_name.trim();
  const paperLabel = form.paper_label.trim();

  if (!profileName || !paperLabel) return null;
  if (width === null || height === null || printScale === null || width <= 0 || height <= 0 || printScale <= 0) return null;
  if (topOffset === null || leftOffset === null) return null;

  return {
    profile_id: profileId,
    profile_name: profileName,
    paper_label: paperLabel,
    width_mm: width,
    height_mm: height,
    top_offset_mm: topOffset,
    left_offset_mm: leftOffset,
    print_scale: printScale,
    notes: form.notes.trim() || undefined,
  };
}

export function CalibrationProfilesPanel({
  config,
  readOnly,
  onChange,
  onTestPrint,
}: CalibrationProfilesPanelProps) {
  const profiles = config.calibration_profiles || [];
  const [selectedProfileId, setSelectedProfileId] = useState(
    config.default_calibration_profile_id || profiles[0]?.profile_id || '',
  );
  const selectedProfile = useMemo(
    () => profiles.find(profile => profile.profile_id === selectedProfileId) || null,
    [profiles, selectedProfileId],
  );
  const [form, setForm] = useState<ProfileForm>(() => selectedProfile ? profileToForm(selectedProfile) : paperToForm(config));
  const draftProfile = formToProfile(form, selectedProfile?.profile_id || 'draft');
  const canMutate = !readOnly && draftProfile !== null;

  useEffect(() => {
    if (selectedProfileId && profiles.some(profile => profile.profile_id === selectedProfileId)) return;
    setSelectedProfileId(config.default_calibration_profile_id || profiles[0]?.profile_id || '');
  }, [config.default_calibration_profile_id, profiles, selectedProfileId]);

  useEffect(() => {
    setForm(selectedProfile ? profileToForm(selectedProfile) : paperToForm(config));
  }, [config, selectedProfile]);

  const configWithProfile = (nextProfile: DocumentTemplateCalibrationProfile) => ({
    ...config,
    calibration_profiles: profiles.map(profile => profile.profile_id === selectedProfile?.profile_id ? nextProfile : profile),
    default_calibration_profile_id: nextProfile.profile_id,
  });

  const updateForm = (key: keyof ProfileForm, value: string) => {
    const nextForm = { ...form, [key]: value };
    const nextProfile = selectedProfile ? formToProfile(nextForm, selectedProfile.profile_id) : null;
    setForm(nextForm);
    if (!readOnly && selectedProfile && nextProfile) {
      onChange(configWithProfile(nextProfile));
    }
  };

  const createProfile = () => {
    const profile = formToProfile(form, profileIdFromName(form.profile_name || form.paper_label));
    if (!profile || readOnly) return;
    const nextProfiles = [...profiles, profile];
    setSelectedProfileId(profile.profile_id);
    onChange({
      ...config,
      calibration_profiles: nextProfiles,
      default_calibration_profile_id: profile.profile_id,
    });
  };

  const applyProfile = () => {
    if (!selectedProfile || !draftProfile || readOnly) return;
    onChange(applyCalibrationProfileToConfig(configWithProfile(draftProfile), selectedProfile.profile_id));
  };

  const updateProfile = () => {
    if (!selectedProfile || !draftProfile || readOnly) return;
    const nextProfile = { ...draftProfile, profile_id: selectedProfile.profile_id };
    onChange(configWithProfile(nextProfile));
  };

  const deleteProfile = () => {
    if (!selectedProfile || readOnly) return;
    const nextProfiles = profiles.filter(profile => profile.profile_id !== selectedProfile.profile_id);
    const nextDefaultId = config.default_calibration_profile_id === selectedProfile.profile_id
      ? nextProfiles[0]?.profile_id
      : config.default_calibration_profile_id;
    setSelectedProfileId(nextDefaultId || nextProfiles[0]?.profile_id || '');
    onChange({
      ...config,
      calibration_profiles: nextProfiles,
      default_calibration_profile_id: nextDefaultId,
    });
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-white">Calibration profiles</h4>
          <p className="mt-0.5 text-[11px] text-slate-400">Save paper offsets and scale for printer stock.</p>
        </div>
        <button
          type="button"
          onClick={() => selectedProfile && draftProfile ? onTestPrint(selectedProfile.profile_id) : undefined}
          disabled={!selectedProfile || !draftProfile}
          className="inline-flex h-8 items-center rounded-lg border border-blue-200 px-3 text-xs font-semibold text-blue-700 disabled:opacity-40 dark:border-blue-900 dark:text-blue-300"
        >
          Test Print with marks
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
        <label className="text-xs font-medium text-slate-500">
          Profile
          <select
            value={selectedProfileId}
            onChange={event => setSelectedProfileId(event.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Current paper settings</option>
            {profiles.map(profile => (
              <option key={profile.profile_id} value={profile.profile_id}>
                {profile.profile_name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <label className="col-span-2 text-xs font-medium text-slate-500">
            Name
            <input
              value={form.profile_name}
              onChange={event => updateForm('profile_name', event.target.value)}
              disabled={readOnly}
              placeholder="Printer / paper"
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="col-span-2 text-xs font-medium text-slate-500">
            Paper
            <input
              value={form.paper_label}
              onChange={event => updateForm('paper_label', event.target.value)}
              disabled={readOnly}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <label className="text-xs font-medium text-slate-500">
            W
            <input type="number" step="0.1" value={form.width_mm} onChange={event => updateForm('width_mm', event.target.value)} disabled={readOnly}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            H
            <input type="number" step="0.1" value={form.height_mm} onChange={event => updateForm('height_mm', event.target.value)} disabled={readOnly}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Top
            <input type="number" step="0.1" value={form.top_offset_mm} onChange={event => updateForm('top_offset_mm', event.target.value)} disabled={readOnly}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Left
            <input type="number" step="0.1" value={form.left_offset_mm} onChange={event => updateForm('left_offset_mm', event.target.value)} disabled={readOnly}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            Scale
            <input type="number" step="0.01" value={form.print_scale} onChange={event => updateForm('print_scale', event.target.value)} disabled={readOnly}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="col-span-2 text-xs font-medium text-slate-500">
            Notes
            <input
              value={form.notes}
              onChange={event => updateForm('notes', event.target.value)}
              disabled={readOnly}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={createProfile} disabled={!canMutate}
          className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-40">
          Create profile from current paper
        </button>
        <button type="button" onClick={applyProfile} disabled={readOnly || !selectedProfile}
          className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
          Apply profile
        </button>
        <button type="button" onClick={updateProfile} disabled={!canMutate || !selectedProfile}
          className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
          Update profile
        </button>
        <button type="button" onClick={deleteProfile} disabled={readOnly || !selectedProfile}
          className="inline-flex h-8 items-center rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300">
          Delete profile
        </button>
      </div>
    </section>
  );
}
