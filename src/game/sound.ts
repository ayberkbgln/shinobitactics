import { JutsuType } from './types';

class ShinobiSoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainVal = 0.1,
    endFreq?: number,
    delay = 0,
  ): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playBuy(): void {
    this.playTone(587.33, 0.09, 'triangle', 0.09, 659.25, 0);
    this.playTone(880, 0.12, 'triangle', 0.08, 987.77, 0.05);
  }

  playSell(): void {
    this.playTone(784, 0.08, 'sine', 0.08, 523.25, 0);
    this.playTone(1046.5, 0.1, 'sine', 0.06, 1318.5, 0.06);
  }

  playPlace(): void {
    this.playTone(180, 0.09, 'triangle', 0.12, 95, 0);
  }

  playReroll(): void {
    this.playTone(392, 0.06, 'square', 0.045, 523.25, 0);
    this.playTone(523.25, 0.08, 'triangle', 0.06, 659.25, 0.04);
  }

  playMerge(stars: number): void {
    // Japanese pentatonic ascending koto fanfare
    const notes = stars === 3 ? [440, 523.25, 659.25, 880, 1046.5] : [440, 587.33, 659.25, 880];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.24, 'triangle', 0.11, n * 1.01, idx * 0.07);
    });
  }

  playCombatStart(): void {
    // Taiko drum double hit
    this.playTone(130, 0.22, 'sine', 0.18, 58, 0);
    this.playTone(150, 0.28, 'sine', 0.2, 52, 0.14);
  }

  playHit(isCrit: boolean): void {
    const jitter = 0.92 + Math.random() * 0.16;
    if (isCrit) {
      this.playTone(520 * jitter, 0.11, 'sawtooth', 0.07, 160, 0);
    } else {
      this.playTone(260 * jitter, 0.07, 'triangle', 0.055, 110, 0);
    }
  }

  playJutsu(type?: JutsuType): void {
    if (type === 'chidori_dash' || type === 'lightning_cutter' || type === 'flying_flash') {
      this.playTone(980, 0.16, 'sawtooth', 0.07, 320, 0);
      this.playTone(1480, 0.12, 'square', 0.04, 620, 0.04);
    } else if (type === 'cherry_heal' || type === 'twin_lion_shield') {
      this.playTone(523.25, 0.22, 'sine', 0.09, 783.99, 0);
      this.playTone(659.25, 0.25, 'sine', 0.07, 1046.5, 0.06);
    } else if (type === 'meteor_drop' || type === 'sand_coffin' || type === 'toad_oil_flame') {
      this.playTone(160, 0.32, 'sawtooth', 0.11, 48, 0);
      this.playTone(220, 0.24, 'triangle', 0.08, 70, 0.05);
    } else {
      this.playTone(420, 0.2, 'sawtooth', 0.07, 740, 0);
      this.playTone(260, 0.22, 'triangle', 0.08, 120, 0.06);
    }
  }

  playKo(): void {
    this.playTone(220, 0.18, 'triangle', 0.09, 75, 0);
  }

  playVictory(): void {
    [440, 587.33, 659.25, 880].forEach((n, i) => {
      this.playTone(n, 0.28, 'triangle', 0.1, n, i * 0.09);
    });
  }

  playDefeat(): void {
    [330, 293.66, 220, 174.61].forEach((n, i) => {
      this.playTone(n, 0.3, 'sawtooth', 0.07, n * 0.94, i * 0.11);
    });
  }
}

export const sound = new ShinobiSoundEngine();
