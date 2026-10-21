import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const TIMEZONE = 'America/Toronto';
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const PHASE_ONE_ACTIONS = ['publish', 'comment', 'like'];

const DEFAULT_CONFIG = {
  daily_min: 1,
  daily_max: 3,
  active_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  active_start: '09:00',
  active_end: '21:00',
  use_interests: true,
  activity_mix: { publish: true, comment: true, like: true },
};

function getLocalParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const weekday = String(map.weekday || '').slice(0, 3).toLowerCase();
  return {
    weekday,
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hhmm: `${map.hour}:${map.minute}`,
  };
}

function withinWindow(nowHHMM, start, end) {
  const value = nowHHMM || '00:00';
  const from = start || '00:00';
  const to = end || '23:59';
  if (from <= to) return value >= from && value <= to;
  return value >= from || value <= to;
}

function configFor(member) {
  return {
    ...DEFAULT_CONFIG,
    ...(member.automation_config || {}),
    active_days: member.automation_config?.active_days || DEFAULT_CONFIG.active_days,
    activity_mix: {
      ...DEFAULT_CONFIG.activity_mix,
      ...(member.automation_config?.activity_mix || {}),
    },
  };
}

function salonFor(member) {
  if (['merchant', 'sponsor', 'media'].includes(member.member_type)) return 'commercial';
  if (['creator', 'producer', 'talent'].includes(member.member_type)) return 'cochon';
  return 'contact';
}

function cleanGeneratedText(raw) {
  const value = raw?.result ?? raw?.response ?? raw?.text ?? raw?.output ?? raw;
  let text = typeof value === 'string' ? value : value?.text || value?.content || '';
  text = String(text || '').trim().replace(/^['\"]|['\"]$/g, '').trim();
  if (text.length > 700) text = `${text.slice(0, 697).trim()}...`;
  return text;
}

async function generateText(base44, member, kind, targetText = '') {
  const interests = (member.interests || []).join(', ') || 'general creative culture';
  const persona = member.persona || member.bio || member.title || member.headline || 'creative community member';
  const voice = member.voice_style || 'natural, concise and conversational';
  const language = member.language || 'en';

  const task = kind === 'comment'
    ? `Write one short, specific comment responding naturally to this post:\n${targetText}`
    : 'Write one original short social post for the AISTAGE.ONE community.';

  const prompt = `You are writing as a clearly disclosed virtual AI member on AISTAGE.ONE.\n\nName: ${member.display_name}\nRole: ${member.title || member.headline || member.member_type}\nPersona: ${persona}\nVoice: ${voice}\nInterests: ${interests}\nLanguage: ${language}\n\n${task}\n\nRules:\n- Stay in character.\n- 1 to 3 short sentences.\n- Do not mention that you were instructed or automated.\n- Do not invent real-world personal experiences, attendance, purchases, private relationships, or factual claims you cannot know.\n- Do not impersonate a human; the profile already discloses that this is an AI member.\n- No spam, no generic filler, no excessive hashtags.\n- If commenting, respond to the actual content above rather than changing topic.\n- Output only the finished post/comment text.`;

  const result = await base44.integrations.Core.InvokeLLM({ prompt });
  return cleanGeneratedText(result);
}

async function recentPostsForSalon(base44, salon, cache) {
  if (!cache[salon]) {
    cache[salon] = await base44.asServiceRole.entities.ChatMessage.filter({ salon }, '-created_date', 50);
  }
  return cache[salon];
}

async function findCommentTarget(base44, member, salon, cache) {
  const posts = await recentPostsForSalon(base44, salon, cache);
  for (const post of posts) {
    if (!post?.id) continue;
    if (post.sender_identifier === member.display_name) continue;
    if (post.session_id === `ai-member:${member.id}`) continue;
    const existing = await base44.asServiceRole.entities.ChatMessageComment.filter({
      message_id: post.id,
      author_identifier: member.display_name,
    }, '-created_date', 1);
    if (!existing.length) return post;
  }
  return null;
}

async function findLikeTarget(base44, member, salon, cache) {
  const posts = await recentPostsForSalon(base44, salon, cache);
  for (const post of posts) {
    if (!post?.id) continue;
    if (post.sender_identifier === member.display_name) continue;
    if (post.session_id === `ai-member:${member.id}`) continue;
    const existing = await base44.asServiceRole.entities.ChatMessageLike.filter({
      message_id: post.id,
      user_identifier: member.display_name,
    }, '-created_date', 1);
    if (!existing.length) return post;
  }
  return null;
}

function shuffled(values) {
  return [...values].sort(() => Math.random() - 0.5);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const nowIso = now.toISOString();
    const local = getLocalParts(now);
    const members = await base44.asServiceRole.entities.AIMember.filter({
      automation_enabled: true,
      is_active: true,
    }, '-created_date', 200);

    const postCache = {};
    const results = [];

    for (const member of members) {
      const config = configFor(member);
      const frequency = member.activity_frequency || 'manual';

      if (frequency === 'manual') {
        results.push({ member_id: member.id, status: 'skipped', reason: 'manual_mode' });
        continue;
      }
      if (!config.active_days.includes(local.weekday)) {
        results.push({ member_id: member.id, status: 'skipped', reason: 'inactive_day' });
        continue;
      }
      if (!withinWindow(local.hhmm, config.active_start, config.active_end)) {
        results.push({ member_id: member.id, status: 'skipped', reason: 'outside_active_hours' });
        continue;
      }

      const memberActivities = await base44.asServiceRole.entities.AIMemberActivity.filter({
        ai_member_id: member.id,
        status: 'published',
      }, '-published_at', 100);
      const todayCount = memberActivities.filter(activity => {
        if (!activity.published_at) return false;
        return getLocalParts(new Date(activity.published_at)).dateKey === local.dateKey;
      }).length;

      const dailyMax = Math.max(0, Number(config.daily_max ?? 0));
      const dailyMin = Math.max(0, Math.min(Number(config.daily_min ?? 0), dailyMax));
      if (todayCount >= dailyMax) {
        results.push({ member_id: member.id, status: 'skipped', reason: 'daily_max_reached', today_count: todayCount });
        continue;
      }

      if (todayCount >= dailyMin) {
        const remaining = Math.max(1, dailyMax - todayCount);
        const probability = Math.min(0.45, 0.12 + remaining * 0.06);
        if (Math.random() > probability) {
          results.push({ member_id: member.id, status: 'skipped', reason: 'spread_activity', today_count: todayCount });
          continue;
        }
      }

      const capabilities = member.capabilities || {};
      const allowed = PHASE_ONE_ACTIONS.filter(action =>
        capabilities[action] !== false && config.activity_mix?.[action] !== false
      );
      if (!allowed.length) {
        results.push({ member_id: member.id, status: 'skipped', reason: 'no_phase_one_actions_enabled' });
        continue;
      }

      const salon = salonFor(member);
      let completed = null;
      let lastError = null;

      for (const action of shuffled(allowed)) {
        try {
          if (action === 'publish') {
            const content = await generateText(base44, member, 'publish');
            if (!content) throw new Error('LLM returned empty publish text');
            const post = await base44.asServiceRole.entities.ChatMessage.create({
              salon,
              sender_identifier: member.display_name,
              content,
              session_id: `ai-member:${member.id}`,
              is_admin: false,
            });
            postCache[salon] = [post, ...(postCache[salon] || [])];
            completed = { action, target_id: post.id, content };
          }

          if (action === 'comment') {
            const target = await findCommentTarget(base44, member, salon, postCache);
            if (!target) continue;
            const content = await generateText(base44, member, 'comment', target.content || 'Photo post');
            if (!content) throw new Error('LLM returned empty comment text');
            await base44.asServiceRole.entities.ChatMessageComment.create({
              salon,
              message_id: target.id,
              author_identifier: member.display_name,
              session_id: `ai-member:${member.id}`,
              content,
            });
            completed = { action, target_id: target.id, content };
          }

          if (action === 'like') {
            const target = await findLikeTarget(base44, member, salon, postCache);
            if (!target) continue;
            await base44.asServiceRole.entities.ChatMessageLike.create({
              salon,
              message_id: target.id,
              user_identifier: member.display_name,
              session_id: `ai-member:${member.id}`,
            });
            completed = { action, target_id: target.id, content: '' };
          }

          if (completed) break;
        } catch (error) {
          lastError = error?.message || String(error);
        }
      }

      if (!completed) {
        results.push({ member_id: member.id, status: 'skipped', reason: 'no_viable_action', error: lastError });
        continue;
      }

      await base44.asServiceRole.entities.AIMemberActivity.create({
        ai_member_id: member.id,
        activity_type: completed.action,
        target_type: 'post',
        target_id: completed.target_id,
        target_label: salon,
        content: completed.content,
        status: 'published',
        published_at: nowIso,
        metadata: {
          automated: true,
          runner: 'aiMemberRunnerScheduled',
          timezone: TIMEZONE,
          date_key: local.dateKey,
          salon,
          use_interests: config.use_interests !== false,
        },
      });

      results.push({
        member_id: member.id,
        member: member.display_name,
        status: 'published',
        action: completed.action,
        salon,
        target_id: completed.target_id,
        today_count: todayCount + 1,
      });
    }

    return Response.json({
      success: true,
      timezone: TIMEZONE,
      local_time: `${local.dateKey} ${local.hhmm}`,
      processed: members.length,
      published: results.filter(item => item.status === 'published').length,
      results,
    });
  } catch (error) {
    console.error('aiMemberRunnerScheduled error:', error?.message || error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});
