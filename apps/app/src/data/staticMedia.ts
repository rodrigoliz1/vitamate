function staticAsset(path: string) {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path}`;
}

export const mealImageUrls: Record<string, string> = Object.fromEntries(
  [
    'eggs-beans-tortilla',
    'tofu-oats-berries',
    'oats-berries-yogurt',
    'turkey-pasta',
    'salmon-potato-salad',
    'chicken-rice-bowl',
    'tofu-quinoa-bowl',
    'greek-yogurt-fruit',
    'lentil-tacos',
    'hummus-toast',
    'tuna-tostadas',
    'chickpea-curry',
  ].map((key) => [key, staticAsset(`media/meals/${key}.webp`)]),
);

export const exerciseGuideUrls: Record<string, string> = Object.fromEntries(
  [
    'backpack-romanian-deadlift',
    'single-leg-calf-raise',
    'chair-triceps-dip',
    'standing-calf-raise',
    'leg-press',
    'one-arm-row',
    'kneeling-cable-crunch',
    'split-squat',
    'plank',
    'romanian-deadlift',
    'triceps-pressdown',
    'backpack-curl',
    'dead-bug',
    'row',
    'lateral-raise',
    'pike-push-up',
    'goblet-squat',
    'lat-pulldown',
    'glute-bridge',
    'home-reverse-lunge',
    'barbell-curl',
    'reverse-lunge',
    'shoulder-press',
    'chest-press',
    'incline-barbell-press',
    'push-up',
    'squat',
    'moderate-cardio',
  ].map((slug) => [slug, staticAsset(`media/exercises/${slug}.webp`)]),
);
