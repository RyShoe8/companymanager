import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import IdeChatMarkdown from '@/components/ide/IdeChatMarkdown';

describe('IdeChatMarkdown', () => {
  it('renders bold and clickable links without raw markdown markers', () => {
    const html = renderToStaticMarkup(
      <IdeChatMarkdown text={'See **Castlevania ReVamped** at [InvertedDungeon](https://www.inverteddungeon.com/page).'} />
    );
    expect(html).not.toContain('**');
    expect(html).toContain('<strong');
    expect(html).toContain('href="https://www.inverteddungeon.com/page"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('InvertedDungeon');
  });
});
