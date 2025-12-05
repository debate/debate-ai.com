"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import type { TimerSpeech } from "@/lib/flow/types";

interface SpeechTimerProps {
  speeches: TimerSpeech[];
  onComplete?: () => void;
}

export function SpeechTimer({ speeches, onComplete }: SpeechTimerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(speeches[0].time);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentSpeech = speeches[currentIndex];

  useEffect(() => {
    setTimeRemaining(currentSpeech.time);
    setIsRunning(false);
  }, [currentIndex, currentSpeech.time]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            if (audioRef.current) {
              audioRef.current.play();
            }
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setTimeRemaining(currentSpeech.time);
    setIsRunning(false);
  };

  const nextSpeech = () => {
    if (currentIndex < speeches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const progress = (1 - timeRemaining / currentSpeech.time) * 100;
  const isWarning = timeRemaining <= 30 && timeRemaining > 0;
  const isTimeUp = timeRemaining === 0;

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Timer Display */}
      <div
        className={`relative rounded-lg p-8 text-center transition-colors ${
          isTimeUp
            ? "bg-red-500 text-white"
            : isWarning
            ? "bg-yellow-500 text-white"
            : currentSpeech.secondary
            ? "bg-blue-500 text-white"
            : "bg-green-500 text-white"
        }`}
      >
        <div className="text-sm font-medium mb-2">{currentSpeech.name}</div>
        <div className="text-6xl font-bold tabular-nums">
          {formatTime(timeRemaining)}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 overflow-hidden rounded-b-lg">
          <div
            className="h-full bg-white transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 justify-center">
        <Button onClick={toggleTimer} size="lg">
          {isRunning ? (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start
            </>
          )}
        </Button>
        <Button onClick={resetTimer} variant="outline" size="lg">
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button onClick={nextSpeech} variant="outline" size="lg">
          <SkipForward className="h-4 w-4 mr-2" />
          Next
        </Button>
      </div>

      {/* Speech List */}
      {speeches.length > 1 && (
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {speeches.map((speech, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`p-3 rounded-lg text-left transition-colors ${
                index === currentIndex
                  ? "bg-blue-100 dark:bg-blue-900 border-2 border-blue-500"
                  : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <div className="font-medium text-sm truncate">{speech.name}</div>
              <div className="text-xs text-muted-foreground">
                {formatTime(speech.time)}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Hidden audio for beep */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSBQOV63n67lfHAQ7ktvy0H4yBSB7yfDekTsHGGS56+ylVRMISnC/7+aVRAsaZ7rm6qNSEgpAnN/yuHMiBS2CzvLWhzQGHWm96+mjTg8KTqjn6raaPQgmfsvxz30vBilzyO7ijjgIGGGz6+qmUhIJRpu/7OOYRQwZZ7jm6qNSEglFn+Dyu3QjBSyBzvLVhy8GGGi86+qiTQ4JSafe762ZQQgicMPv3pE7BxdhsuvrpVETCEOZvu7hlkYNFlq147BfHAQ5kdfy0X4zBSGAzvLZiDQGGGK56+2kTw8KS6fg6rObPQcjd8bv1o09BxZdsOvspVQUCkSawuzhllALFV6y5+ukUhEISJ/g7rR3IgQshc7x1YU1BRxqvevqo04NCUqk3+utmT4IJnfJ8dp+MQYaaLjr76ZWEwlCmb/u4JVEDBVYr+nnok8RCEqj4O6ubCIELIfO8dWEMgUZaL3s66JODQ1NpuDqr5Y/CCRxwu/iikAHElyx6OulUxQKQ5m/7uCUQgsUWqzt56JNDwtMp9/usHAjBC2Dze7gizsGGWS46+2iSw8LTqff6rCXPQgpcMPv3JI6BxNZsOjnpVMTCkWavObflEALElWq5e2kUBMJTKDg7KeNOgUqf8rv2IU3BhxrvO3ppE0ODU6o3+uwljsIJXLA7t+WPwgSV6/o56VREwlEm73r4JNCCxRVqePupVEOCkqb3+2tly8FKYDCztqBNwYdab3r6qNNDQxNo+DrsJY8CCVwwu7dl

j4IElew6OilUREKQ5q9796UQQsUV6nk7KNREwlJnt/usG0jBC2Gz/HUhDYGGmi76+mjTQ4LTKfg7LKZPggke8Lv4Jc+BxFWsOnnpVQSCkOZv+7hk0ILFFao5O2kThEJSaDg77BvJAMthtDy1YY4BhpovOvppE4NCkyp4Oyyly4FKHvB7+CZPwgSVrDp6KVSEwpCmL3u4JI/CxNVqOPto08QCUue3++xlCwGLojQ8dSGNgYaaL3s66RODAtMp+Dss5kuBSl7wO/gl0AHElSu6OilUxIKQpi97+GTQAsUVajk7KRPEQpJn+Dwr3EkBS6I0fHVhjYGGWi86uukTgwLTKfh7LGYMAI..."
      />
    </div>
  );
}
