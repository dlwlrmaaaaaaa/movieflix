import assert from 'node:assert/strict';
import { EMBED_PROVIDER_CONFIGS } from '../src/config/embedProviders';
import { ConfiguredEmbedProvider } from '../src/providers/ConfiguredEmbedProvider';
import { EmbedProviderRegistry } from '../src/services/embedProviderRegistry';
import { buildMovieEmbedUrl, buildTvEpisodeEmbedUrl } from '../src/services/embedUrlBuilder';

async function main() {
  const config = EMBED_PROVIDER_CONFIGS.find((provider) => provider.id === 'vidcore')!;
  assert.equal(config.enabled, false);
  assert.equal(config.distributionPermissionVerified, false);
  assert.equal(buildMovieEmbedUrl(config, 550), 'https://www.vidcore.org/embed/movie/550');
  assert.throws(() => buildMovieEmbedUrl(config, '../550'));
  assert.throws(() => buildTvEpisodeEmbedUrl(config, 550, 1, 1));
  const movie = { mediaType: 'movie', tmdbId: 550 };
  const registry = (...configs: typeof config[]) => new EmbedProviderRegistry(configs.map((item) => new ConfiguredEmbedProvider(item)));
  assert.deepEqual(await registry(config).resolveAll(movie, 'web'), []);
  assert.deepEqual(await registry({ ...config, enabled: true }).resolveAll(movie, 'web'), []);
  assert.deepEqual(await registry({ ...config, distributionPermissionVerified: true }).resolveAll(movie, 'web'), []);
  // Synthetic authorization is local to this test and never changes production flags.
  const authorized = { ...config, enabled: true, distributionPermissionVerified: true };
  const players = await registry(authorized, { ...authorized, id: 'second', name: 'Second' }).resolveAll(movie, 'web');
  assert.deepEqual(players.map((player) => [player.providerId, player.tmdbId]), [['vidcore', 550], ['second', 550]]);
  assert.equal(await registry(authorized).resolveTvEpisode(550, 1, 1, 'web'), null);
  assert.equal(await registry({ ...authorized, supportsMobile: false }).resolveMovie(550, 'mobile'), null);
  await assert.rejects(registry({ ...authorized, allowedEmbedHosts: ['example.org'] }).resolveMovie(550, 'web'));
  console.log('VidCore policy and multiple-provider checks passed.');
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
