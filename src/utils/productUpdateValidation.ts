type SlideDraft = { title?: string; body?: string };

export function validateProductUpdateDraft(title: string, slides: SlideDraft[], status: string): string | null {
  if (!title?.trim() || !Array.isArray(slides) || slides.length < 1 || slides.length > 6 ||
      slides.some((slide) => !slide.title?.trim() || !slide.body?.trim())) {
    return "Add an update label and 1–6 slides with a title and description.";
  }
  if (status === "published" && slides.some((slide) =>
    slide.title!.trim().length < 3 || slide.title!.trim().length > 80 ||
    slide.body!.trim().length < 15 || slide.body!.trim().length > 280
  )) {
    return "For publishing, each slide needs a useful title (3–80 characters) and a short description (15–280 characters).";
  }
  return null;
}
