BEGIN;
-- CreateTable
CREATE TABLE "Drama" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalLanguage" TEXT NOT NULL,
    "originCountry" TEXT[],
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "description" TEXT NOT NULL,
    "year" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "genres" TEXT[],

    CONSTRAINT "Drama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "dramaId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "runtime" INTEGER,
    "description" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "airDate" TEXT,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeSource" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeSubtitle" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "vtt" TEXT NOT NULL,
    "cues" JSONB NOT NULL,

    CONSTRAINT "EpisodeSubtitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "positionSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Drama_tmdbId_key" ON "Drama"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_dramaId_seasonNumber_key" ON "Season"("dramaId", "seasonNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_seasonId_episodeNumber_key" ON "Episode"("seasonId", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeSource_movieId_key" ON "EpisodeSource"("movieId");

-- CreateIndex
CREATE INDEX "EpisodeSource_episodeId_enabled_idx" ON "EpisodeSource"("episodeId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeSubtitle_episodeId_language_key" ON "EpisodeSubtitle"("episodeId", "language");

-- CreateIndex
CREATE INDEX "EpisodeProgress_userId_lastWatchedAt_idx" ON "EpisodeProgress"("userId", "lastWatchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeProgress_userId_episodeId_key" ON "EpisodeProgress"("userId", "episodeId");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeSource" ADD CONSTRAINT "EpisodeSource_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeSource" ADD CONSTRAINT "EpisodeSource_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeSubtitle" ADD CONSTRAINT "EpisodeSubtitle_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeProgress" ADD CONSTRAINT "EpisodeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeProgress" ADD CONSTRAINT "EpisodeProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
