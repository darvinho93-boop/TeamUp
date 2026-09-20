/** Types du manifeste PWA, importé en JSON par les applications. */
declare const manifest: {
  name: string;
  short_name: string;
  description: string;
  lang: string;
  dir: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  categories: string[];
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
};

export default manifest;
