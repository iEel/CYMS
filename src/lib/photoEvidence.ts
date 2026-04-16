export type PhotoCategory =
  | 'front'
  | 'rear'
  | 'left'
  | 'right'
  | 'roof'
  | 'floor'
  | 'csc_plate'
  | 'seal'
  | 'reefer_unit'
  | 'temperature_display'
  | 'damage_closeup'
  | 'other';

export interface EvidencePhoto {
  id: string;
  url: string;
  category: PhotoCategory;
  label: string;
  taken_at: string;
  note?: string;
  damage_point_id?: string;
  required?: boolean;
}

export interface PhotoRequirement {
  category: PhotoCategory;
  label: string;
  required: boolean;
  met: boolean;
  missing_reason?: string;
}

export interface PhotoCompleteness {
  required: number;
  completed: number;
  total: number;
  missing_categories: string[];
}

export interface DamagePointWithPhoto {
  id: string;
  side: string;
  type: string;
  severity?: string;
  photo?: string;
}

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  front: 'ด้านหน้า',
  rear: 'ด้านหลัง',
  left: 'ด้านซ้าย',
  right: 'ด้านขวา',
  roof: 'หลังคา',
  floor: 'พื้นตู้',
  csc_plate: 'ป้าย CSC / ข้อมูลตู้',
  seal: 'ซีล',
  reefer_unit: 'เครื่องทำความเย็น',
  temperature_display: 'หน้าจออุณหภูมิ',
  damage_closeup: 'รูปใกล้จุดเสียหาย',
  other: 'อื่นๆ',
};

export const STANDARD_PHOTO_CATEGORIES: PhotoCategory[] = [
  'front',
  'rear',
  'left',
  'right',
  'roof',
  'floor',
  'csc_plate',
  'seal',
  'reefer_unit',
  'temperature_display',
  'other',
];

function requiredCategoriesForTemplate(templateKey?: string): PhotoCategory[] {
  const key = (templateKey || 'dry').toLowerCase();
  const categories: PhotoCategory[] = ['front', 'rear', 'left', 'right', 'csc_plate'];

  if (key.includes('reefer')) {
    categories.push('reefer_unit', 'temperature_display');
  }

  if (key.includes('open_top')) {
    categories.push('roof');
  }

  if (key.includes('flat_rack') || key.includes('tank')) {
    categories.push('floor');
  }

  return Array.from(new Set(categories));
}

export function normalizeEvidencePhotos(
  photos: EvidencePhoto[] | string[] | undefined | null,
  fallbackCategory: PhotoCategory = 'other',
): EvidencePhoto[] {
  if (!Array.isArray(photos)) return [];

  return photos
    .filter(Boolean)
    .map((photo, index) => {
      if (typeof photo === 'string') {
        return {
          id: `legacy-${index}`,
          url: photo,
          category: fallbackCategory,
          label: PHOTO_CATEGORY_LABELS[fallbackCategory],
          taken_at: '',
        };
      }

      return {
        ...photo,
        id: photo.id || `photo-${index}`,
        label: photo.label || PHOTO_CATEGORY_LABELS[photo.category] || PHOTO_CATEGORY_LABELS.other,
      };
    });
}

export function buildDamageEvidencePhotos(points: DamagePointWithPhoto[] = []): EvidencePhoto[] {
  return points
    .filter(point => Boolean(point.photo))
    .map((point, index) => ({
      id: `damage-${point.id || index}`,
      url: point.photo as string,
      category: 'damage_closeup',
      label: `${PHOTO_CATEGORY_LABELS.damage_closeup} ${index + 1}`,
      taken_at: '',
      damage_point_id: point.id,
      required: point.severity !== 'minor',
    }));
}

export function buildPhotoRequirements(
  templateKey: string | undefined,
  evidencePhotos: EvidencePhoto[],
  damagePoints: DamagePointWithPhoto[] = [],
): PhotoRequirement[] {
  const requiredCategories = requiredCategoriesForTemplate(templateKey);
  const hasDamage = damagePoints.length > 0;
  const categories = hasDamage ? [...requiredCategories, 'damage_closeup' as PhotoCategory] : requiredCategories;
  const uniqueCategories = Array.from(new Set(categories));

  return uniqueCategories.map(category => {
    const met = category === 'damage_closeup'
      ? damagePoints.some(point => Boolean(point.photo)) || evidencePhotos.some(photo => photo.category === category)
      : evidencePhotos.some(photo => photo.category === category);

    return {
      category,
      label: PHOTO_CATEGORY_LABELS[category],
      required: true,
      met,
      missing_reason: met ? undefined : 'ยังไม่มีรูปตามหมวดนี้',
    };
  });
}

export function summarizePhotoCompleteness(
  requirements: PhotoRequirement[],
  totalPhotos: number,
): PhotoCompleteness {
  const required = requirements.filter(item => item.required);
  const completed = required.filter(item => item.met);

  return {
    required: required.length,
    completed: completed.length,
    total: totalPhotos,
    missing_categories: required.filter(item => !item.met).map(item => item.label),
  };
}

export function buildPhotoEvidenceSnapshot(params: {
  templateKey?: string;
  evidencePhotos?: EvidencePhoto[];
  legacyPhotos?: string[];
  damagePoints?: DamagePointWithPhoto[];
}) {
  const normalized = normalizeEvidencePhotos(params.evidencePhotos || params.legacyPhotos || [], 'other');
  const damageEvidence = buildDamageEvidencePhotos(params.damagePoints || []);
  const photoEvidence = [...normalized, ...damageEvidence];
  const requirements = buildPhotoRequirements(params.templateKey, normalized, params.damagePoints || []);
  const completeness = summarizePhotoCompleteness(requirements, photoEvidence.length);

  return {
    photo_evidence: photoEvidence,
    photo_requirements: requirements,
    photo_completeness: completeness,
  };
}
