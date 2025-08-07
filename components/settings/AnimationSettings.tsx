'use client';

import React from 'react';
import { useAnimation, AnimationDuration, AnimationEasing } from '@/lib/animations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { AnimatedButton, AnimatedBadge } from '@/components/ui/animated-components';
import { HoverScale, ClickRipple } from '@/components/ui/micro-interactions';
import { useAnimationPerformance } from '@/lib/animations';
import { Activity, Settings, Zap, Eye } from 'lucide-react';

export function AnimationSettings() {
  const { 
    config, 
    updateConfig, 
    isReducedMotion,
    shouldAnimate 
  } = useAnimation();
  const { fps, isPerformanceGood } = useAnimationPerformance();
  const { t } = useI18n();

  const handleDurationChange = (duration: AnimationDuration) => {
    updateConfig({ duration });
  };

  const handleEasingChange = (easing: AnimationEasing) => {
    updateConfig({ easing });
  };

  const handleStaggerDelayChange = (values: number[]) => {
    updateConfig({ staggerDelay: values[0] });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>{t('animations.settings.title')}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('animations.settings.description')}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* System Status */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Activity className="w-5 h-5" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">
                    {t('animations.performance.fps', { fps: fps.toFixed(0) })}
                  </span>
                  <AnimatedBadge 
                    variant={isPerformanceGood ? 'default' : 'destructive'}
                    size="sm"
                  >
                    {isPerformanceGood 
                      ? t('animations.performance.good')
                      : t('animations.performance.poor')
                    }
                  </AnimatedBadge>
                </div>
                {isReducedMotion && (
                  <p className="text-xs text-muted-foreground">
                    {t('animations.accessibility.reducedMotionEnabled')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Animation Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="respect-reduced-motion" className="text-base">
                {t('animations.settings.reducedMotion')}
              </Label>
              <Switch
                id="respect-reduced-motion"
                checked={config.respectReducedMotion}
                onCheckedChange={(checked) => updateConfig({ respectReducedMotion: checked })}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('animations.settings.reducedMotionDesc')}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-interactions" className="text-base">
                {t('animations.settings.enableInteractions')}
              </Label>
              <Switch
                id="enable-interactions"
                checked={config.enableInteractions}
                onCheckedChange={(checked) => updateConfig({ enableInteractions: checked })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-transitions" className="text-base">
                {t('animations.settings.enableTransitions')}
              </Label>
              <Switch
                id="enable-transitions"
                checked={config.enableTransitions}
                onCheckedChange={(checked) => updateConfig({ enableTransitions: checked })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="enable-scroll-animations" className="text-base">
                {t('animations.settings.enableScrollAnimations')}
              </Label>
              <Switch
                id="enable-scroll-animations"
                checked={config.enableScrollAnimations}
                onCheckedChange={(checked) => updateConfig({ enableScrollAnimations: checked })}
              />
            </div>
          </div>

          {/* Animation Speed */}
          <div className="space-y-4">
            <Label className="text-base">{t('animations.settings.animationSpeed')}</Label>
            <Select 
              value={config.duration} 
              onValueChange={handleDurationChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">
                  {t('animations.settings.duration.instant')}
                </SelectItem>
                <SelectItem value="fast">
                  {t('animations.settings.duration.fast')}
                </SelectItem>
                <SelectItem value="normal">
                  {t('animations.settings.duration.normal')}
                </SelectItem>
                <SelectItem value="slow">
                  {t('animations.settings.duration.slow')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Animation Easing */}
          <div className="space-y-4">
            <Label className="text-base">Animation Easing</Label>
            <Select 
              value={config.easing} 
              onValueChange={handleEasingChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">
                  {t('animations.settings.easing.linear')}
                </SelectItem>
                <SelectItem value="ease-in">
                  {t('animations.settings.easing.easeIn')}
                </SelectItem>
                <SelectItem value="ease-out">
                  {t('animations.settings.easing.easeOut')}
                </SelectItem>
                <SelectItem value="ease-in-out">
                  {t('animations.settings.easing.easeInOut')}
                </SelectItem>
                <SelectItem value="bounce">
                  {t('animations.settings.easing.bounce')}
                </SelectItem>
                <SelectItem value="elastic">
                  {t('animations.settings.easing.elastic')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stagger Delay */}
          <div className="space-y-4">
            <Label className="text-base">
              Stagger Delay: {config.staggerDelay}ms
            </Label>
            <Slider
              value={[config.staggerDelay]}
              onValueChange={handleStaggerDelayChange}
              max={200}
              min={0}
              step={10}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Animation Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5" />
            <span>Animation Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Hover Scale */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Hover Scale</p>
              <HoverScale>
                <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mx-auto">
                  <Zap className="w-6 h-6" />
                </div>
              </HoverScale>
            </div>

            {/* Click Ripple */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Click Ripple</p>
              <ClickRipple>
                <div className="w-16 h-16 bg-secondary rounded-lg flex items-center justify-center mx-auto cursor-pointer">
                  <Zap className="w-6 h-6" />
                </div>
              </ClickRipple>
            </div>

            {/* Animated Button */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Animated Button</p>
              <AnimatedButton 
                size="sm"
                animation="bounce"
                className="mx-auto"
              >
                Click me
              </AnimatedButton>
            </div>

            {/* Animated Badge */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Animated Badge</p>
              <AnimatedBadge 
                hoverable 
                className="mx-auto"
              >
                Hover me
              </AnimatedBadge>
            </div>
          </div>

          {/* Performance Note */}
          {!isPerformanceGood && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Performance Notice:</strong> Animations are running below optimal performance. 
                Consider reducing animation complexity or enabling reduced motion for better experience.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AnimationSettings;