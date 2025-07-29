/**
 * Utility functions for managing URL parameters
 */

/**
 * Adds or updates a filter parameter in the current URL while preserving other parameters
 */
export function addFilterToUrl(filterKey: string, filterValue: string | number): string {
  const params = new URLSearchParams(window.location.search);
  params.set(filterKey, filterValue.toString());
  return `?${params.toString()}`;
}

/**
 * Removes a filter parameter from the current URL while preserving other parameters
 */
export function removeFilterFromUrl(filterKey: string): string {
  const params = new URLSearchParams(window.location.search);
  params.delete(filterKey);
  const newURL = params.toString() ? `?${params.toString()}` : '';
  return newURL;
}

/**
 * Toggles a filter parameter - adds it if not present, removes it if already present
 */
export function toggleFilterInUrl(filterKey: string, filterValue: string | number, currentValue?: string | number): string {
  const currentValueStr = currentValue?.toString();
  const newValueStr = filterValue.toString();
  
  if (currentValueStr === newValueStr) {
    // Remove the filter if it's already set to the same value
    return removeFilterFromUrl(filterKey);
  } else {
    // Add/update the filter
    return addFilterToUrl(filterKey, filterValue);
  }
}

/**
 * Clears all filters except the specified one and applies only that filter
 */
export function applyOnlyFilter(filterKey: string, filterValue: string | number): string {
  const params = new URLSearchParams();
  params.set(filterKey, filterValue.toString());
  return `?${params.toString()}`;
}

/**
 * Removes all filters from the URL
 */
export function removeAllFilters(): string {
  return '';
} 