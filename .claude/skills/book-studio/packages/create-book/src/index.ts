#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

interface TemplateManifest {
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  themes: string[];
  defaultTheme: string;
}

// Dynamically discover templates from template.json manifests
async function discoverTemplates(): Promise<TemplateManifest[]> {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const templates: TemplateManifest[] = [];

  try {
    const dirs = await fs.readdir(templatesDir);
    for (const dir of dirs) {
      const manifestPath = path.join(templatesDir, dir, 'template.json');
      if (await fs.pathExists(manifestPath)) {
        const manifest = await fs.readJson(manifestPath);
        templates.push(manifest);
      }
    }
  } catch {
    // Fallback if discovery fails
  }

  // Sort: blank first, then alphabetical
  templates.sort((a, b) => {
    if (a.name === 'blank') return -1;
    if (b.name === 'blank') return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return templates;
}

const PACKAGE_MANAGERS = ['npm', 'yarn', 'pnpm', 'bun'];

interface Answers {
  projectName: string;
  template: string;
  theme: string;
  packageManager: string;
  install: boolean;
  title: string;
  author: string;
}

async function createBook() {
  console.log(chalk.cyan('\n📚 Welcome to Bookmotion!\n'));
  console.log(chalk.gray('Create beautiful books with React\n'));

  // Dynamically discover available templates
  const templates = await discoverTemplates();
  const templateMap = new Map(templates.map((t) => [t.name, t]));

  const answers = await inquirer.prompt<Answers>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: 'my-book',
      validate: (input) => {
        if (!input.trim()) return 'Project name is required';
        if (!/^[a-z0-9-_]+$/i.test(input)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'template',
      message: 'Choose a template:',
      choices: templates.map((t) => ({
        name: `${chalk.bold(t.displayName)} - ${chalk.gray(t.description)}`,
        value: t.name,
      })),
      default: 'blank',
    },
    {
      type: 'list',
      name: 'theme',
      message: 'Choose a theme:',
      choices: (prev: Partial<Answers>) => {
        const tmpl = templateMap.get(prev.template || 'blank');
        const themeIds = tmpl?.themes || ['modern-sans'];
        const defaultTheme = tmpl?.defaultTheme || themeIds[0];

        return [
          ...themeIds.map((id) => ({
            name: id === defaultTheme
              ? `${chalk.bold(id)} ${chalk.gray('(recommended)')}`
              : id,
            value: id,
          })),
          { name: chalk.gray('none (use defaults)'), value: 'none' },
        ];
      },
      default: (prev: Partial<Answers>) => {
        const tmpl = templateMap.get(prev.template || 'blank');
        return tmpl?.defaultTheme || 'modern-sans';
      },
    },
    {
      type: 'input',
      name: 'title',
      message: 'Book title:',
      default: (answers: Partial<Answers>) =>
        answers.projectName
          ?.replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase()) || 'My Book',
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author name:',
      default: 'Your Name',
    },
    {
      type: 'list',
      name: 'packageManager',
      message: 'Package manager:',
      choices: PACKAGE_MANAGERS,
      default: 'npm',
    },
    {
      type: 'confirm',
      name: 'install',
      message: 'Install dependencies?',
      default: true,
    },
  ]);

  const targetDir = path.resolve(process.cwd(), answers.projectName);

  // Check if directory exists
  if (await fs.pathExists(targetDir)) {
    const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${answers.projectName} exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\nCancelled.\n'));
      return;
    }

    await fs.remove(targetDir);
  }

  // Create project directory
  await fs.ensureDir(targetDir);

  // Copy template files
  const templateDir = path.join(__dirname, '..', 'templates', answers.template);
  
  if (await fs.pathExists(templateDir)) {
    await fs.copy(templateDir, targetDir);
  } else {
    // Create from scratch if template doesn't exist
    await createFromScratch(targetDir, answers);
  }

  // Update package.json with project name
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.name = answers.projectName;
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }

  // Update book.config.ts with title, author, and theme
  const configPath = path.join(targetDir, 'book.config.ts');
  if (await fs.pathExists(configPath)) {
    let configContent = await fs.readFile(configPath, 'utf-8');

    // Replace title placeholders (various formats used across templates)
    configContent = configContent.replace(/title: "My Book"/, `title: "${answers.title}"`);
    configContent = configContent.replace(/title: "The Little Explorer"/, `title: "${answers.title}"`);
    configContent = configContent.replace(/title: "My Photo Album"/, `title: "${answers.title}"`);
    configContent = configContent.replace(/title: "My Comic"/, `title: "${answers.title}"`);
    configContent = configContent.replace(/title: "My Portfolio"/, `title: "${answers.title}"`);
    configContent = configContent.replace(/title: "My Recipes"/, `title: "${answers.title}"`);
    configContent = configContent.replace(/title: "My Journal"/, `title: "${answers.title}"`);
    configContent = configContent.replace(/title: "My Novel"/, `title: "${answers.title}"`);

    // Replace author
    configContent = configContent.replace(/author: "Your Name"/g, `author: "${answers.author}"`);

    // Inject theme if selected
    if (answers.theme && answers.theme !== 'none') {
      // Add theme import at the top
      const themeImport = `import { getThemeById } from '@bookmotion/core';\n`;
      if (!configContent.includes('getThemeById')) {
        configContent = configContent.replace(
          "import { BookConfig } from '@bookmotion/core';",
          `import { BookConfig } from '@bookmotion/core';\n${themeImport}`
        );
      }

      // Add theme property to config (before outputs or at end of config object)
      if (!configContent.includes('theme:')) {
        const themeProperty = `\n  // Theme\n  theme: getThemeById('${answers.theme}'),\n`;
        // Insert before outputs if present, otherwise before closing bracket
        if (configContent.includes('outputs:')) {
          configContent = configContent.replace(/(\s+)(outputs:)/, `${themeProperty}$1$2`);
        } else {
          configContent = configContent.replace(/\n};/, `${themeProperty}};`);
        }
      }
    }

    await fs.writeFile(configPath, configContent);
  }

  // Remove template.json from the generated project (it's a build artifact)
  const templateJsonPath = path.join(targetDir, 'template.json');
  if (await fs.pathExists(templateJsonPath)) {
    await fs.remove(templateJsonPath);
  }

  // Install dependencies
  if (answers.install) {
    console.log(chalk.cyan('\n📦 Installing dependencies...\n'));
    
    const { execa } = await import('execa');
    try {
      await execa(answers.packageManager, ['install'], {
        cwd: targetDir,
        stdio: 'inherit',
      });
    } catch (error) {
      console.log(chalk.yellow('\n⚠️  Failed to install dependencies. Run manually:\n'));
      console.log(chalk.white(`  cd ${answers.projectName}`));
      console.log(chalk.white(`  ${answers.packageManager} install\n`));
    }
  }

  // Success message
  console.log(chalk.green('\n✅ Book project created!\n'));
  console.log(chalk.white(`  Template: ${chalk.bold(templateMap.get(answers.template)?.displayName || answers.template)}`));
  if (answers.theme !== 'none') {
    console.log(chalk.white(`  Theme:    ${chalk.bold(answers.theme)}`));
  }
  console.log('');
  console.log(chalk.white(`  cd ${answers.projectName}`));

  if (!answers.install) {
    console.log(chalk.white(`  ${answers.packageManager} install`));
  }

  console.log(chalk.white('  npm run dev'));
  console.log(chalk.gray('\n  Start the dev server and begin creating your book!\n'));
}

async function createFromScratch(targetDir: string, answers: Answers) {
  // Create basic structure
  await fs.ensureDir(path.join(targetDir, 'public', 'assets'));
  await fs.ensureDir(path.join(targetDir, 'src', 'pages'));

  // Create package.json
  const packageJson = {
    name: answers.projectName,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'book-motion dev',
      'render:images': 'book-motion render images',
      'render:pdf': 'book-motion render pdf',
      'render:epub': 'book-motion render epub',
      'render:web': 'book-motion render web',
      'render:all': 'book-motion render all',
    },
    dependencies: {
      '@bookmotion/core': '^0.1.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      typescript: '^5.0.0',
      vite: '^4.4.0',
    },
  };

  await fs.writeJson(path.join(targetDir, 'package.json'), packageJson, { spaces: 2 });

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      useDefineForClassFields: true,
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      skipLibCheck: true,
      moduleResolution: 'bundler',
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      isolatedModules: true,
      noEmit: true,
      jsx: 'react-jsx',
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
    },
    include: ['src'],
    references: [{ path: './tsconfig.node.json' }],
  };

  await fs.writeJson(path.join(targetDir, 'tsconfig.json'), tsconfig, { spaces: 2 });

  // Create book.config.ts
  const configContent = `import { BookConfig } from '@bookmotion/core';

export const config: BookConfig = {
  title: "${answers.title}",
  author: "${answers.author}",
  dimensions: { width: 6, height: 9, unit: 'in' },
  margins: { top: 0.5, bottom: 0.5, inner: 0.75, outer: 0.5 },
  bleed: 0.125,
  dpi: 300,
  colorSpace: 'CMYK',
};
`;

  await fs.writeFile(path.join(targetDir, 'book.config.ts'), configContent);

  // Create src/index.tsx
  const indexContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { Root } from './Root';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
`;

  await fs.writeFile(path.join(targetDir, 'src', 'index.tsx'), indexContent);

  // Create src/Root.tsx based on template
  const rootContent = generateRootContent(answers.template, answers.title, answers.author);
  await fs.writeFile(path.join(targetDir, 'src', 'Root.tsx'), rootContent);

  // Create index.html
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${answers.title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`;

  await fs.writeFile(path.join(targetDir, 'index.html'), htmlContent);
}

function generateRootContent(template: string, title: string, author: string): string {
  const baseImport = `import { Book, Page, Chapter } from '@bookmotion/core';`;
  
  switch (template) {
    case 'children-book':
      return `${baseImport}
import { config } from '../book.config';
import { CoverPage } from './pages/CoverPage';
import { StoryPage } from './pages/StoryPage';

export const Root = () => (
  <Book config={config}>
    <CoverPage title="${title}" author="${author}" />
    
    <Chapter title="The Story" number={1}>
      <StoryPage 
        illustration="assets/page1.jpg"
        text="Once upon a time, in a land far away, there lived a brave little hero..."
      />
      <StoryPage 
        illustration="assets/page2.jpg"
        text="Every day was a new adventure, filled with wonder and excitement."
      />
      <StoryPage 
        illustration="assets/page3.jpg"
        text="And they all lived happily ever after. The End."
      />
    </Chapter>
  </Book>
);
`;
    
    case 'cookbook':
      return `${baseImport}
import { config } from '../book.config';
import { CoverPage } from './pages/CoverPage';
import { RecipePage } from './pages/RecipePage';

export const Root = () => (
  <Book config={config}>
    <CoverPage title="${title}" author="${author}" />
    
    <Chapter title="Breakfast" number={1}>
      <RecipePage
        title="Fluffy Pancakes"
        prepTime={15}
        cookTime={10}
        servings={4}
        ingredients={[
          '2 cups flour',
          '2 eggs',
          '1 3/4 cups milk',
          '1/4 cup butter, melted',
        ]}
        steps={[
          'Mix dry ingredients in a bowl',
          'Whisk wet ingredients separately',
          'Combine and mix until smooth',
          'Cook on griddle until golden',
        ]}
      />
    </Chapter>
    
    <Chapter title="Main Courses" number={2}>
      <RecipePage
        title="Classic Pasta"
        prepTime={10}
        cookTime={20}
        servings={4}
        ingredients={['400g pasta', '2 cups sauce', 'Parmesan cheese']}
        steps={['Boil pasta', 'Heat sauce', 'Combine and serve']}
      />
    </Chapter>
  </Book>
);
`;
    
    case 'journal':
      return `${baseImport}
import { Journal, DailyPage, WeeklySpread } from '@bookmotion/journal';
import { config } from '../book.config';

export const Root = () => (
  <Book config={config}>
    <Journal
      dateRange={{ start: '2025-01-01', end: '2025-12-31' }}
      pagePattern="daily"
    >
      <DailyPage prompts={['Gratitude', 'Focus', 'Notes']} />
    </Journal>
  </Book>
);
`;
    
    case 'novel':
      return `${baseImport}
import { config } from '../book.config';
import { TitlePage } from './pages/TitlePage';
import { ChapterOpening } from './pages/ChapterOpening';
import { BodyText } from './pages/BodyText';

const chapter1Text = \`
It was the best of times, it was the worst of times...
\`;

export const Root = () => (
  <Book config={config}>
    <TitlePage title="${title}" author="${author}" />
    
    <Chapter title="The Beginning" number={1}>
      <ChapterOpening />
      <BodyText content={chapter1Text} />
    </Chapter>
  </Book>
);
`;
    
    default: // blank
      return `${baseImport}
import { config } from '../book.config';

export const Root = () => (
  <Book config={config}>
    <Chapter title="Chapter 1" number={1}>
      <Page layout="margins">
        <h1>${title}</h1>
        <p>By ${author}</p>
        <p>Start creating your book here...</p>
      </Page>
    </Chapter>
  </Book>
);
`;
  }
}

program
  .name('create-book')
  .description('Create a new Bookmotion book project')
  .version('0.1.0')
  .action(createBook);

program.parse();
