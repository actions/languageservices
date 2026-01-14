import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {Value} from "@actions/languageservice/value-providers/config";

const MARKETPLACE_SEARCH_URL = "https://github.com/editor/actions/marketplace-search";
const MARKETPLACE_DETAIL_URL = "https://github.com/editor/actions/marketplace";
const MIN_QUERY_LENGTH = 3;
const COMPLETION_KIND_MODULE = 9; // CompletionItemKind.Module

interface MarketplaceAction {
  id: string;
  title: string;
  owner: string;
  stars: number;
  description: string;
}

/**
 * Parses star count strings like "1.3k" or "205" into numbers
 */
function parseStarsCount(starsStr: string): number {
  const trimmed = starsStr.trim().toLowerCase();
  if (trimmed.endsWith("k")) {
    return Math.round(parseFloat(trimmed.slice(0, -1)) * 1000);
  }
  return parseInt(trimmed, 10) || 0;
}

/**
 * Parses the search results HTML to extract action metadata
 */
function parseSearchResults(html: string): MarketplaceAction[] {
  const actions: MarketplaceAction[] = [];

  // Split by action item markers and process each chunk
  const chunks = html.split('js-marketplace-action-search-item"');

  // Skip the first chunk (before any action items)
  for (let i = 1; i < chunks.length; i++) {
    const itemHtml = chunks[i];

    // Extract marketplace ID from the sidebar URL
    const idMatch = itemHtml.match(/data-workflow-editor-sidebar-url="[^"]*\/marketplace\/(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // Extract title from aria-label on first button
    const titleMatch = itemHtml.match(/aria-label="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : "";

    // Extract owner - look for "By <span...>owner</span>"
    const ownerMatch = itemHtml.match(/By\s*<span[^>]*>([^<]+)<\/span>/);
    const owner = ownerMatch ? ownerMatch[1].trim() : "";

    // Extract stars - in the float-right span
    const starsMatch = itemHtml.match(
      /<span class="float-right text-small color-fg-muted[^"]*">\s*<svg[^>]*>[\s\S]*?<\/svg>\s*([^<]+)/
    );
    const stars = starsMatch ? parseStarsCount(starsMatch[1]) : 0;

    // Extract description - the last paragraph with ws-normal class
    const descMatch = itemHtml.match(
      /<p class="color-fg-muted lh-condensed mb-0 ws-normal">([^<]+)<\/p>/
    );
    const description = descMatch ? descMatch[1].trim() : "";

    actions.push({id, title, owner, stars, description});
  }

  return actions;
}

/**
 * Parses the action detail page to extract the uses value (e.g., "owner/repo@version")
 * Prefers version tags over commit SHAs
 */
function parseActionDetail(html: string): string | undefined {
  // Look for uses: lines - there are typically two formats:
  // 1. SHA: uses: owner/repo@abc123...
  // 2. Version: uses: owner/repo@v1.2.3
  // We prefer the version format (shorter, contains 'v')
  const usesMatches = html.match(/uses:\s*([\w-]+\/[\w._-]+@[\w.+-]+)/g);
  if (!usesMatches || usesMatches.length === 0) {
    return undefined;
  }

  // Find the first version tag (contains @v) or fall back to the first match
  for (const match of usesMatches) {
    const value = match.replace(/^uses:\s*/, "");
    if (value.includes("@v")) {
      return value;
    }
  }

  // Fall back to first match (likely SHA)
  return usesMatches[0].replace(/^uses:\s*/, "");
}

/**
 * Fetches marketplace search results and detail pages to build completion values
 */
export async function getStepUsesValues(context: WorkflowContext): Promise<Value[]> {
  const query = context.currentValue?.trim() || "";

  // Don't search with very short queries
  if (query.length < MIN_QUERY_LENGTH) {
    return [];
  }

  try {
    // Fetch search results
    const searchUrl = `${MARKETPLACE_SEARCH_URL}?query=${encodeURIComponent(query)}`;
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      return [];
    }
    const searchHtml = await searchResponse.text();
    const actions = parseSearchResults(searchHtml);

    if (actions.length === 0) {
      return [];
    }

    // Fetch detail pages in parallel to get the actual uses values
    const detailPromises = actions.map(async (action): Promise<Value | null> => {
      try {
        const detailUrl = `${MARKETPLACE_DETAIL_URL}/${action.id}`;
        const detailResponse = await fetch(detailUrl);
        if (!detailResponse.ok) {
          return null;
        }
        const detailHtml = await detailResponse.text();
        const usesValue = parseActionDetail(detailHtml);

        if (!usesValue) {
          return null;
        }

        // Create sort text that puts higher star counts first
        // Pad to 10 digits so sorting works correctly
        const invertedStars = 10000000000 - action.stars;
        const sortText = invertedStars.toString().padStart(10, "0");

        return {
          label: usesValue,
          description: action.description,
          kind: COMPLETION_KIND_MODULE,
          sortText
        };
      } catch {
        return null;
      }
    });

    const results = await Promise.all(detailPromises);

    // Filter out nulls and return
    return results.filter((v): v is Value => v !== null);
  } catch {
    return [];
  }
}
