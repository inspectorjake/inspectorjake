/**
 * Tests for tool result rendering in the tool registry.
 */

import { describe, it, expect } from 'vitest';
import { toolDefs } from '../tool-registry.js';

const seeNotes = toolDefs.find((t) => t.name === 'see_jakes_notes')!;
const selection = {
  type: 'element' as const,
  id: 'cta',
  selector: 'button.cta',
  tagName: 'button',
  dimensions: '160×44',
  rect: { x: 0, y: 0, width: 160, height: 44 },
  hint: 'Use view_image_in_jakes_notes tool with imageId="cta" to see this element\'s screenshot',
  note: 'Make it orange',
};
const text = (result: ReturnType<NonNullable<typeof seeNotes.handleResult>>) =>
  result.content.map((c) => ('text' in c ? c.text : '')).join('\n');

describe('see_jakes_notes', () => {
  it('says when the captures are the batch Claude already read', () => {
    const result = seeNotes.handleResult!({ success: true, result: { selections: [selection], alreadySeen: true } }, {});
    const body = text(result);
    expect(body).toMatch(/^No new captures\. These are the ones you already saw/);
    expect(body).toContain('Make it orange');
  });

  it('shows new captures without that notice', () => {
    const body = text(seeNotes.handleResult!({ success: true, result: { selections: [selection] } }, {}));
    expect(body).not.toContain('already saw');
    expect(body).toContain('Make it orange');
  });

  it('explains when there is nothing at all', () => {
    const body = text(seeNotes.handleResult!({ success: true, result: { selections: [] } }, {}));
    expect(body).toContain('No selections.');
  });
});
