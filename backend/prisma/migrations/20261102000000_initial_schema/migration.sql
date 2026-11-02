-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'COMPATIBILITY_CHECK', 'WATCHING', 'ENDED');

-- CreateEnum
CREATE TYPE "PartnerInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "MovieStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "MovieSourceType" AS ENUM ('UPLOAD', 'STREAM', 'MANIFEST');

-- CreateEnum
CREATE TYPE "StreamingFormat" AS ENUM ('AUTO', 'DASH', 'HLS', 'MP4', 'WEBM');

-- CreateEnum
CREATE TYPE "PlaybackMode" AS ENUM ('IFRAME', 'DIRECT', 'SCREEN_SHARE', 'MANUAL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ViewerReadiness" AS ENUM ('WAITING', 'LOADING', 'BUFFERING', 'READY', 'ERROR', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "activeSessionId" TEXT,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "partnerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWatchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "overview" TEXT,
    "releaseYear" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "posterUrl" TEXT,
    "backdropUrl" TEXT,
    "positionSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "completionPercent" DOUBLE PRECISION NOT NULL,
    "lastWatchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerInvite" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "inviteEmail" TEXT NOT NULL,
    "receiverId" TEXT,
    "code" TEXT NOT NULL,
    "status" "PartnerInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "hostId" TEXT NOT NULL,
    "guestId" TEXT,
    "isHostOnlyControl" BOOLEAN NOT NULL DEFAULT false,
    "catalogSelection" JSONB,
    "currentMovieTitle" TEXT,
    "playbackPosition" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "playbackIsPlaying" BOOLEAN NOT NULL DEFAULT false,
    "playbackUpdatedAt" TIMESTAMP(3),
    "playbackVersion" INTEGER NOT NULL DEFAULT 0,
    "playbackMode" "PlaybackMode" NOT NULL DEFAULT 'MANUAL',
    "screenSharingUserId" TEXT,
    "selectedMovieId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movie" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "status" "MovieStatus" NOT NULL DEFAULT 'UPLOADING',
    "sourceType" "MovieSourceType" NOT NULL DEFAULT 'UPLOAD',
    "streamingUrl" TEXT,
    "streamingFormat" "StreamingFormat",
    "manifestBaseUrl" TEXT,
    "description" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "posterKey" TEXT,
    "posterUrl" TEXT,
    "multipartUploadId" TEXT,
    "tmdbId" INTEGER,
    "providerId" TEXT,
    "providerSourceId" TEXT,
    "licenseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieUploadPart" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "eTag" TEXT NOT NULL,

    CONSTRAINT "MovieUploadPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMovieMeta" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "fileSizeBytes" BIGINT,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "mediaPath" TEXT,
    "mimeType" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomMovieMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomViewerState" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedMovieId" TEXT NOT NULL,
    "state" "ViewerReadiness" NOT NULL DEFAULT 'WAITING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomViewerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieHistory" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerName" TEXT NOT NULL,
    "movieTitle" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "MovieHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_partnerId_key" ON "User"("partnerId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserWatchlist_userId_createdAt_idx" ON "UserWatchlist"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserWatchlist_userId_tmdbId_key" ON "UserWatchlist"("userId", "tmdbId");

-- CreateIndex
CREATE INDEX "WatchProgress_userId_lastWatchedAt_idx" ON "WatchProgress"("userId", "lastWatchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchProgress_userId_tmdbId_key" ON "WatchProgress"("userId", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerInvite_code_key" ON "PartnerInvite"("code");

-- CreateIndex
CREATE INDEX "PartnerInvite_code_idx" ON "PartnerInvite"("code");

-- CreateIndex
CREATE INDEX "PartnerInvite_inviteEmail_idx" ON "PartnerInvite"("inviteEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_code_idx" ON "Room"("code");

-- CreateIndex
CREATE INDEX "Room_selectedMovieId_idx" ON "Room"("selectedMovieId");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_storageKey_key" ON "Movie"("storageKey");

-- CreateIndex
CREATE INDEX "Movie_ownerId_status_idx" ON "Movie"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Movie_sourceType_status_idx" ON "Movie"("sourceType", "status");

-- CreateIndex
CREATE INDEX "Movie_tmdbId_idx" ON "Movie"("tmdbId");

-- CreateIndex
CREATE INDEX "Movie_providerId_providerSourceId_idx" ON "Movie"("providerId", "providerSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieUploadPart_movieId_partNumber_key" ON "MovieUploadPart"("movieId", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMovieMeta_roomId_userId_key" ON "RoomMovieMeta"("roomId", "userId");

-- CreateIndex
CREATE INDEX "RoomViewerState_roomId_selectedMovieId_idx" ON "RoomViewerState"("roomId", "selectedMovieId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomViewerState_roomId_userId_key" ON "RoomViewerState"("roomId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_idx" ON "ChatMessage"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieHistory_roomId_key" ON "MovieHistory"("roomId");

-- CreateIndex
CREATE INDEX "MovieHistory_userId_idx" ON "MovieHistory"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWatchlist" ADD CONSTRAINT "UserWatchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchProgress" ADD CONSTRAINT "WatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInvite" ADD CONSTRAINT "PartnerInvite_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerInvite" ADD CONSTRAINT "PartnerInvite_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_selectedMovieId_fkey" FOREIGN KEY ("selectedMovieId") REFERENCES "Movie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieUploadPart" ADD CONSTRAINT "MovieUploadPart_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMovieMeta" ADD CONSTRAINT "RoomMovieMeta_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomViewerState" ADD CONSTRAINT "RoomViewerState_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieHistory" ADD CONSTRAINT "MovieHistory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieHistory" ADD CONSTRAINT "MovieHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

