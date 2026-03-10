'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  SkipBack,
  SkipForward,
} from 'lucide-react';

interface RecordingPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  recording: {
    id: string;
    phoneNumber: string;
    startTime: string;
    duration: number;
    recordingUrl?: string;
  } | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingPlayer({ isOpen, onClose, recording }: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || recording?.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [recording?.duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume || 1;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
  };

  const handleDownload = () => {
    if (recording?.recordingUrl) {
      window.open(recording.recordingUrl, '_blank');
    }
  };

  if (!recording) return null;

  // Mock audio URL for demo (in production, this would be a real recording URL)
  const audioUrl = recording.recordingUrl || '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            録音再生
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recording Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">電話番号</span>
              <span className="font-mono">{recording.phoneNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">通話日時</span>
              <span>
                {format(new Date(recording.startTime), 'yyyy/MM/dd HH:mm', {
                  locale: ja,
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">通話時間</span>
              <span>{formatTime(recording.duration)}</span>
            </div>
          </div>

          {/* Audio Element (hidden) */}
          {audioUrl && (
            <audio ref={audioRef} src={audioUrl} preload="metadata" />
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration || recording.duration}
              step={1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration || recording.duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(-10)}
              disabled={!audioUrl}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={togglePlay}
              disabled={!audioUrl}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skip(10)}
              disabled={!audioUrl}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Volume & Download */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="cursor-pointer"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!recording.recordingUrl}
            >
              <Download className="h-4 w-4 mr-2" />
              ダウンロード
            </Button>
          </div>

          {/* Demo Notice */}
          {!audioUrl && (
            <div className="text-center text-sm text-gray-500 bg-amber-50 p-3 rounded-lg">
              デモモード: 実際の録音ファイルはZoom Phone API連携後に再生可能になります
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
