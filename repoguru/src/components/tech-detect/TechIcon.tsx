import { useState } from 'react';

/**
 * Maps tech names → Simple Icons slug + brand color.
 * CDN: https://cdn.simpleicons.org/{slug}/{color}
 */
const TECH_ICON_MAP: Record<string, { slug: string; color: string }> = {
  // Frameworks — JS/TS
  React: { slug: 'react', color: '61DAFB' },
  'Next.js': { slug: 'nextdotjs', color: 'ffffff' },
  Vue: { slug: 'vuedotjs', color: '4FC08D' },
  Nuxt: { slug: 'nuxtdotjs', color: '00DC82' },
  Angular: { slug: 'angular', color: '0F0F11' },
  Svelte: { slug: 'svelte', color: 'FF3E00' },
  SvelteKit: { slug: 'svelte', color: 'FF3E00' },
  Express: { slug: 'express', color: 'ffffff' },
  NestJS: { slug: 'nestjs', color: 'E0234E' },
  Hono: { slug: 'hono', color: 'E36002' },
  Remix: { slug: 'remix', color: 'ffffff' },
  Astro: { slug: 'astro', color: 'BC52EE' },
  Gatsby: { slug: 'gatsby', color: '663399' },
  Solid: { slug: 'solid', color: '2C4F7C' },
  Preact: { slug: 'preact', color: '673AB8' },
  Fastify: { slug: 'fastify', color: 'ffffff' },
  Koa: { slug: 'koa', color: '33333D' },
  Electron: { slug: 'electron', color: '47848F' },
  'Three.js': { slug: 'threedotjs', color: 'ffffff' },
  'Tailwind CSS': { slug: 'tailwindcss', color: '06B6D4' },
  'Material UI': { slug: 'mui', color: '007FFF' },
  'Chakra UI': { slug: 'chakraui', color: '319795' },
  'Ant Design': { slug: 'antdesign', color: '0170FE' },
  'styled-components': { slug: 'styledcomponents', color: 'DB7093' },
  Emotion: { slug: 'emotion', color: 'C865B9' },
  'Framer Motion': { slug: 'framer', color: '0055FF' },
  'React Router': { slug: 'reactrouter', color: 'CA4245' },
  Redux: { slug: 'redux', color: '764ABC' },
  'Redux Toolkit': { slug: 'redux', color: '764ABC' },
  Zustand: { slug: 'zustand', color: '453B31' },
  'TanStack Query': { slug: 'reactquery', color: 'FF4154' },
  'Socket.IO': { slug: 'socketdotio', color: '010101' },
  tRPC: { slug: 'trpc', color: '2596BE' },

  // Frameworks — Python
  Django: { slug: 'django', color: '092E20' },
  Flask: { slug: 'flask', color: 'ffffff' },
  FastAPI: { slug: 'fastapi', color: '009688' },
  Celery: { slug: 'celery', color: '37814A' },
  Streamlit: { slug: 'streamlit', color: 'FF4B4B' },
  Gradio: { slug: 'gradio', color: 'F97316' },

  // Frameworks — Ruby
  Rails: { slug: 'rubyonrails', color: 'D30001' },
  Sinatra: { slug: 'rubysinatra', color: 'ffffff' },

  // Frameworks — PHP
  Laravel: { slug: 'laravel', color: 'FF2D20' },
  Symfony: { slug: 'symfony', color: 'ffffff' },

  // Frameworks — Java
  'Spring Boot': { slug: 'springboot', color: '6DB33F' },
  Spring: { slug: 'spring', color: '6DB33F' },
  Quarkus: { slug: 'quarkus', color: '4695EB' },

  // Frameworks — Go
  Gin: { slug: 'gin', color: '008ECF' },

  // Frameworks — Rust
  'Actix Web': { slug: 'actix', color: 'ffffff' },

  // Databases & ORMs
  PostgreSQL: { slug: 'postgresql', color: '4169E1' },
  MySQL: { slug: 'mysql', color: '4479A1' },
  MongoDB: { slug: 'mongodb', color: '47A248' },
  Redis: { slug: 'redis', color: 'FF4438' },
  SQLite: { slug: 'sqlite', color: '003B57' },
  'SQL Server': { slug: 'microsoftsqlserver', color: 'CC2927' },
  Elasticsearch: { slug: 'elasticsearch', color: '005571' },
  Cassandra: { slug: 'apachecassandra', color: '1287B1' },
  Neo4j: { slug: 'neo4j', color: '4581C3' },
  Firebase: { slug: 'firebase', color: 'DD2C00' },
  Prisma: { slug: 'prisma', color: '2D3748' },
  Drizzle: { slug: 'drizzle', color: 'C5F74F' },

  // CI/CD & DevOps
  'GitHub Actions': { slug: 'githubactions', color: '2088FF' },
  'GitLab CI': { slug: 'gitlab', color: 'FC6D26' },
  CircleCI: { slug: 'circleci', color: '343434' },
  Jenkins: { slug: 'jenkins', color: 'D24939' },
  'Travis CI': { slug: 'travisci', color: '3EAAAF' },
  'Azure Pipelines': { slug: 'azurepipelines', color: '2560E0' },
  'Bitbucket Pipelines': { slug: 'bitbucket', color: '0052CC' },
  Buildkite: { slug: 'buildkite', color: '14CC80' },
  Docker: { slug: 'docker', color: '2496ED' },
  'Docker Compose': { slug: 'docker', color: '2496ED' },
  Kubernetes: { slug: 'kubernetes', color: '326CE5' },
  Helm: { slug: 'helm', color: '0F1689' },
  Terraform: { slug: 'terraform', color: '844FBA' },
  Terragrunt: { slug: 'terraform', color: '844FBA' },
  Pulumi: { slug: 'pulumi', color: '8A3391' },
  'Serverless Framework': { slug: 'serverless', color: 'FD5750' },
  Make: { slug: 'gnu', color: 'A42E2B' },

  // Testing & Quality
  Jest: { slug: 'jest', color: 'C21325' },
  Vitest: { slug: 'vitest', color: '6E9F18' },
  Mocha: { slug: 'mocha', color: '8D6748' },
  Cypress: { slug: 'cypress', color: '69D3A7' },
  Playwright: { slug: 'playwright', color: '2EAD33' },
  Storybook: { slug: 'storybook', color: 'FF4785' },
  'Testing Library': { slug: 'testinglibrary', color: 'E33332' },
  ESLint: { slug: 'eslint', color: '4B32C3' },
  Prettier: { slug: 'prettier', color: 'F7B93E' },
  Biome: { slug: 'biome', color: '60A5FA' },
  Husky: { slug: 'git', color: 'F05032' },
  pytest: { slug: 'pytest', color: '0A9EDC' },
  Ruff: { slug: 'ruff', color: 'D7FF64' },
  RSpec: { slug: 'ruby', color: 'CC342D' },
  RuboCop: { slug: 'ruby', color: 'CC342D' },
  JUnit: { slug: 'junit5', color: '25A162' },
  'JUnit 5': { slug: 'junit5', color: '25A162' },

  // Cloud providers
  AWS: { slug: 'amazonwebservices', color: '232F3E' },
  Azure: { slug: 'microsoftazure', color: '0078D4' },
  GCP: { slug: 'googlecloud', color: '4285F4' },

  // Languages
  TypeScript: { slug: 'typescript', color: '3178C6' },
  JavaScript: { slug: 'javascript', color: 'F7DF1E' },
  Python: { slug: 'python', color: '3776AB' },
  Go: { slug: 'go', color: '00ADD8' },
  Rust: { slug: 'rust', color: 'ffffff' },
  Ruby: { slug: 'ruby', color: 'CC342D' },
  Java: { slug: 'openjdk', color: 'ffffff' },
  PHP: { slug: 'php', color: '777BB4' },
  Swift: { slug: 'swift', color: 'F05138' },
  Kotlin: { slug: 'kotlin', color: '7F52FF' },
  'C#': { slug: 'csharp', color: '512BD4' },
  'C++': { slug: 'cplusplus', color: '00599C' },
  C: { slug: 'c', color: 'A8B9CC' },
  Dart: { slug: 'dart', color: '0175C2' },
  Elixir: { slug: 'elixir', color: '4B275F' },
  Scala: { slug: 'scala', color: 'DC322F' },
  Haskell: { slug: 'haskell', color: '5D4F85' },
  Lua: { slug: 'lua', color: '2C2D72' },
  R: { slug: 'r', color: '276DC3' },
  Shell: { slug: 'gnubash', color: '4EAA25' },
  CSS: { slug: 'css3', color: '1572B6' },
  HTML: { slug: 'html5', color: 'E34F26' },
  Markdown: { slug: 'markdown', color: 'ffffff' },
  YAML: { slug: 'yaml', color: 'CB171E' },
  TOML: { slug: 'toml', color: '9C4121' },
};

interface TechIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function TechIcon({ name, size = 16, className = '' }: TechIconProps) {
  const [errored, setErrored] = useState(false);
  const entry = TECH_ICON_MAP[name];

  if (!entry || errored) {
    const letter = name.charAt(0).toUpperCase();
    return (
      <span
        className={`inline-flex items-center justify-center rounded text-[10px] font-bold text-text-muted bg-surface-hover ${className}`}
        style={{ width: size, height: size }}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      src={`https://cdn.simpleicons.org/${entry.slug}/${entry.color}`}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      onError={() => setErrored(true)}
    />
  );
}
