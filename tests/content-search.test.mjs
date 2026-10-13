import assert from 'node:assert/strict';
import test from 'node:test';
import { contentTags, matchesSearch, normalizeTags } from '../app/lib/content-search.ts';
import { composerTarget } from '../app/lib/composer-target.ts';

test('visible text gets automatic categories and explicit tags override suggestions', () => {
  assert.deepEqual(contentTags('想找住宿，也可以线上交流'), ['住宿', '学习', '线上']);
  assert.deepEqual(contentTags('想找住宿', ['创作']), ['创作']);
  assert.deepEqual(contentTags('想找住宿', ['分类:其他']), ['分类:其他']);
  assert.deepEqual(contentTags('不知道谁会来'), ['其他']);
  assert.deepEqual(contentTags('想去苏州找住宿'), ['住宿', '地点:苏州']);
  assert.deepEqual(contentTags('线上聊聊', [], '苏州'), ['线上', '地点:苏州']);
  assert.deepEqual(normalizeTags([' #创作 ', '创作', '']), ['创作']);
});
test('search matches ID, case and combined keywords without guessing', () => {
  assert.equal(matchesSearch('MOON 住宿', '月升王国moon', '可以提供住宿'), true);
  assert.equal(matchesSearch('member-b', '月亮', '@moon', 'member-b'), true);
  assert.equal(matchesSearch('苏州', '月亮', '北京'), false);
});
test('explicit profile target wins over stale or empty draft with a compatible circle', () => {
  const circles = [{ id: 'garden', memberIds: ['a', 'b'] }, { id: 'workshop', memberIds: ['a', 'c'] }];
  assert.deepEqual(composerTarget({ otherId: 'b', recordCircleId: 'garden' }, 'c', 'garden', circles), { otherId: 'c', circleId: 'workshop' });
  assert.deepEqual(composerTarget({ otherId: '', recordCircleId: 'garden' }, 'b', 'garden', circles), { otherId: 'b', circleId: 'garden' });
  assert.deepEqual(composerTarget({ otherId: 'b', recordCircleId: 'garden' }, undefined, 'workshop', circles), { otherId: 'b', circleId: 'garden' });
  assert.deepEqual(composerTarget({ otherId: 'missing', recordCircleId: 'garden' }, undefined, 'garden', circles), { otherId: '', circleId: 'garden' });
});
