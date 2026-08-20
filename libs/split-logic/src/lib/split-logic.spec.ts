import { describe, expect, it } from 'bun:test';
import { splitLogic } from './split-logic';

describe('splitLogic', () => {
  it('should work', () => {
    expect(splitLogic()).toEqual('split-logic');
  });
});
