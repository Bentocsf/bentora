export type CatalogBook = {
  id: string;
  title: string;
  authors: string[];
  pageCount: number | null;
  coverUri: string | null;
};

type OpenLibraryResponse = {
  docs?: {
    key?: string;
    title?: string;
    author_name?: string[];
    number_of_pages_median?: number;
    cover_i?: number;
  }[];
};

type SearchOptions = {
  limit?: number;
  signal?: AbortSignal;
};

export async function searchBookCatalog(
  query: string,
  { limit = 20, signal }: SearchOptions = {}
): Promise<CatalogBook[]> {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
    lang: 'pt',
    fields: 'key,title,author_name,number_of_pages_median,cover_i',
  });
  const response = await fetch(
    `https://openlibrary.org/search.json?${params.toString()}`,
    {
      signal,
      headers: { 'User-Agent': 'Bentora/1.0 (bentocsf2@gmail.com)' },
    }
  );

  if (!response.ok) {
    throw new Error(`Open Library respondeu com status ${response.status}.`);
  }

  const data = await response.json() as OpenLibraryResponse;
  return (data.docs ?? [])
    .filter((item) => Boolean(item.key && item.title?.trim()))
    .map((item) => ({
      id: item.key!,
      title: item.title!.trim(),
      authors: item.author_name?.filter(Boolean) ?? [],
      pageCount: Number.isInteger(item.number_of_pages_median) && item.number_of_pages_median! > 0
        ? item.number_of_pages_median!
        : null,
      coverUri: item.cover_i
        ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg?default=false`
        : null,
    }));
}
