import { NewsAndForumsPage } from "../news/page"

/**
 * Old `/practice/forums` address: now the Forums tab of News & Forums at
 * `/news`. The Next app redirects it to `/news?section=forums`; outside Next
 * this mounts the merged page on that tab. Single threads still live at
 * `/practice/forums/<id>`.
 */
export default function ForumsPage() {
  return <NewsAndForumsPage initialSection="forums" />
}
