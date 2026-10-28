type SlideContent = { title?: string; body?: string; imageUrl?: string; ctaLabel?: string };
type ProductUpdateContent = { title?: string; slides?: SlideContent[] };

function normalizedContent(value: ProductUpdateContent) {
  return JSON.stringify({
    title: value.title?.trim() || "",
    slides: (value.slides || []).map((slide) => ({
      title: slide.title?.trim() || "",
      body: slide.body?.trim() || "",
      imageUrl: slide.imageUrl?.trim() || "",
      ctaLabel: slide.ctaLabel?.trim() || "",
    })),
  });
}

export function hasProductUpdateContentChanged(current: ProductUpdateContent, next: ProductUpdateContent): boolean {
  return normalizedContent(current) !== normalizedContent(next);
}
