const APP_SCHEME = "luxewashmobilefe:";
const URI_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;

/**
 * Chuẩn hoá URL Android dùng để mở app trước khi Expo Router dựng navigation state.
 * Một số notification/launcher intent chỉ mở scheme gốc (luxewashmobilefe:///).
 * URL đó phải đi về route `/` thay vì rơi vào màn hình Unmatched Route.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    const trimmedPath = path.trim();
    if (!trimmedPath || trimmedPath === "/") return "/";
    if (trimmedPath.startsWith("/") || !URI_SCHEME_PATTERN.test(trimmedPath)) {
      return path;
    }

    const url = new URL(trimmedPath, "luxewashmobilefe://app");
    if (url.protocol !== APP_SCHEME) return path;

    const routeParts = [url.hostname, ...url.pathname.split("/")].filter(
      Boolean,
    );
    const routePath = routeParts.length > 0 ? `/${routeParts.join("/")}` : "/";

    return `${routePath}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
