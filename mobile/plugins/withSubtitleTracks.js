const fs = require('node:fs');
const path = require('node:path');
const { withDangerousMod } = require('@expo/config-plugins');

// SDK 51 / expo-video 1.1 has a native PlayerView text renderer but no JS text
// track API. Extend only that adapter; never replace or upgrade the player.
const marker = '// AnnahFlix subtitle track bridge';
const bridge = `
      ${marker}
      Property("annahSubtitleTracks")
        .get { ref: VideoPlayer ->
          runBlocking(appContext.mainQueue.coroutineContext) {
            ref.player.currentTracks.groups.flatMapIndexed { groupIndex, group ->
              if (group.type != androidx.media3.common.C.TRACK_TYPE_TEXT) emptyList()
              else (0 until group.length).filter { group.isTrackSupported(it) }.map { trackIndex ->
                val format = group.getTrackFormat(trackIndex)
                mapOf<String, Any>(
                  "id" to "$groupIndex:$trackIndex",
                  "language" to (format.language ?: "und"),
                  "label" to (format.label ?: format.language ?: "Subtitles"),
                  "format" to (format.sampleMimeType ?: "unknown"),
                  "selected" to group.isTrackSelected(trackIndex)
                )
              }
            }
          }
        }

      Property("annahSubtitleTrackId")
        .get { ref: VideoPlayer ->
          runBlocking(appContext.mainQueue.coroutineContext) {
            ref.player.currentTracks.groups.withIndex().firstNotNullOfOrNull { (groupIndex, group) ->
              if (group.type != androidx.media3.common.C.TRACK_TYPE_TEXT) null
              else (0 until group.length).firstOrNull { group.isTrackSelected(it) }?.let { "$groupIndex:$it" }
            }
          }
        }
        .set { ref: VideoPlayer, trackId: String? ->
          appContext.mainQueue.launch {
            val builder = ref.player.trackSelectionParameters.buildUpon()
              .clearOverridesOfType(androidx.media3.common.C.TRACK_TYPE_TEXT)
              .setTrackTypeDisabled(androidx.media3.common.C.TRACK_TYPE_TEXT, trackId == null)
            if (trackId != null) {
              val parts = trackId.split(":")
              val groupIndex = parts.getOrNull(0)?.toIntOrNull()
              val trackIndex = parts.getOrNull(1)?.toIntOrNull()
              val group = groupIndex?.let { ref.player.currentTracks.groups.getOrNull(it) }
              if (group != null && group.type == androidx.media3.common.C.TRACK_TYPE_TEXT && trackIndex != null && trackIndex >= 0 && trackIndex < group.length && group.isTrackSupported(trackIndex)) {
                builder.addOverride(androidx.media3.common.TrackSelectionOverride(group.mediaTrackGroup, listOf(trackIndex)))
              } else return@launch
            }
            ref.player.trackSelectionParameters = builder.build()
          }
        }
`;
function patchVideoModule(source) {
  if (source.includes(marker)) return source;
  const anchor = '    Class(VideoPlayer::class) {';
  if (!source.includes(anchor)) throw new Error('The installed expo-video adapter has changed. Review the AnnahFlix subtitle bridge before building.');
  return source.replace(anchor, anchor + bridge);
}
module.exports = function withSubtitleTracks(config) {
  return withDangerousMod(config, ['android', async (mod) => {
    const packageFile = require.resolve('expo-video/package.json', { paths: [mod.modRequest.projectRoot] });
    const version = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
    const supportedVersions = ['1.1.9', '1.1.10'];
    if (!supportedVersions.includes(version)) throw new Error(`Review the subtitle bridge before using expo-video ${version}. Expected ${supportedVersions.join(' or ')}.`);
    const target = path.join(path.dirname(packageFile), 'android/src/main/java/expo/modules/video/VideoModule.kt');
    const source = fs.readFileSync(target, 'utf8'); const patched = patchVideoModule(source);
    if (patched !== source) fs.writeFileSync(target, patched);
    return mod;
  }]);
};
module.exports.patchVideoModule = patchVideoModule;
