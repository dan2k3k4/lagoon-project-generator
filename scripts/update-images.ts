// Snapshot the uselagoon Docker Hub org into src/lagoon-images.json.
// Run with: npm run update-images
// (hub.docker.com has no CORS headers, so the browser can't query it live.)

// runtime images only — skip lagoon-core/infra repos (api, keycloak, broker, ...)
const FAMILIES = ['php', 'node', 'python', 'ruby', 'mariadb', 'mysql', 'postgres', 'redis', 'valkey', 'solr', 'opensearch', 'elasticsearch', 'varnish', 'mongo', 'nginx', 'commons', 'rabbitmq'];
const RUNTIME_IMAGE = new RegExp(`^(${FAMILIES.join('|')})([.-]|$)`);

async function main() {
  // anonymous requests can't page past the first 100 results, so query each family
  // separately (name= is a substring match; RUNTIME_IMAGE drops the strays)
  const names = new Set<string>();
  for (const family of FAMILIES) {
    const url = `https://hub.docker.com/v2/repositories/uselagoon/?page_size=100&name=${family}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Docker Hub API ${res.status} for ${url}`);
    const data: any = await res.json();
    if (data.next) throw new Error(`more than 100 "${family}" repos; split the family`);
    data.results.forEach((r: any) => names.add(r.name));
  }

  const images = [...names].filter(n => RUNTIME_IMAGE.test(n)).sort();
  const out = {
    updated: new Date().toISOString().slice(0, 10),
    org: 'uselagoon',
    images,
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(new URL('../src/lagoon-images.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote ${images.length} images (of ${names.size} repos) to src/lagoon-images.json`);
}

main();
