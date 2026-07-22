// Snapshot the uselagoon Docker Hub org into src/lagoon-images.json.
// Run with: npm run update-images
// (hub.docker.com has no CORS headers, so the browser can't query it live.)

// runtime images only — skip lagoon-core/infra repos (api, keycloak, broker, ...)
const RUNTIME_IMAGE = /^(php|node|python|ruby|mariadb|mysql|postgres|redis|valkey|solr|opensearch|elasticsearch|varnish|mongo|nginx|commons|rabbitmq)([.-]|$)/;

async function main() {
  const names: string[] = [];
  let url: string | null = 'https://hub.docker.com/v2/repositories/uselagoon/?page_size=100';
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Docker Hub API ${res.status} for ${url}`);
    const data: any = await res.json();
    names.push(...data.results.map((r: any) => r.name));
    url = data.next;
  }

  const images = names.filter(n => RUNTIME_IMAGE.test(n)).sort();
  const out = {
    updated: new Date().toISOString().slice(0, 10),
    org: 'uselagoon',
    images,
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(new URL('../src/lagoon-images.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote ${images.length} images (of ${names.length} repos) to src/lagoon-images.json`);
}

main();
