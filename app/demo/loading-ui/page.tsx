'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useSettings } from '@/app/providers/SettingsProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Loading components
import { 
  LoadingSpinner, 
  LoadingButton, 
  LoadingOverlay,
  ProgressIndicator,
  LoadingDots,
  PulseLoader,
  SkeletonLoader,
  StatusIndicator 
} from '@/components/ui/loading';

// Skeleton components
import { 
  Skeleton,
  TableSkeleton,
  CardSkeleton,
  ListSkeleton,
  ChartSkeleton,
  DashboardSkeleton,
  FormSkeleton,
  ProfileSkeleton,
  NavigationSkeleton,
  SearchResultsSkeleton
} from '@/components/ui/skeleton';

// Optimistic UI components
import {
  ActionStatus,
  OptimisticListItem,
  OptimisticForm,
  OptimisticCounter,
  OptimisticLikeButton,
  OptimisticComments
} from '@/components/ui/optimistic';

import { PendingActionsIndicator } from '@/lib/optimistic-ui';
import { Clock, Heart, MessageSquare, Plus, Minus, Save, Upload, Download } from 'lucide-react';

// Mock data and API functions
const mockComments = [
  {
    id: '1',
    text: 'This is a great example of optimistic UI!',
    author: 'Alice',
    timestamp: new Date(Date.now() - 60000),
  },
  {
    id: '2', 
    text: 'I love how responsive this feels.',
    author: 'Bob',
    timestamp: new Date(Date.now() - 120000),
  }
];

const mockApiCall = (delay = 1000) => new Promise(resolve => 
  setTimeout(() => resolve({ success: true, data: 'API response' }), delay)
);

const mockCounterApi = (increment = true) => 
  mockApiCall(800).then(() => Math.floor(Math.random() * 100));

const mockLikeApi = (itemId: string, liked: boolean) =>
  mockApiCall(600).then(() => ({
    liked,
    count: Math.floor(Math.random() * 50) + (liked ? 1 : 0)
  }));

const mockCommentApi = (text: string) =>
  mockApiCall(900).then(() => ({
    id: `comment-${Date.now()}`,
    text,
    author: 'You',
    timestamp: new Date()
  }));

export default function LoadingUIDemo() {
  const settings = useSettings();
  const [showOverlay, setShowOverlay] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [skeletonDemo, setSkeletonDemo] = useState(true);

  // Progress simulation
  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setIsLoading(false);
            return 0;
          }
          return prev + Math.random() * 15;
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // Skeleton demo toggle
  useEffect(() => {
    const timer = setTimeout(() => setSkeletonDemo(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const startProgress = () => {
    setIsLoading(true);
    setProgress(0);
  };

  const toggleOverlay = () => {
    setShowOverlay(!showOverlay);
    if (!showOverlay) {
      setTimeout(() => setShowOverlay(false), 3000);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Loading States & Optimistic UI Demo</h1>
        <p className="text-muted-foreground">
          Comprehensive showcase of loading indicators, skeleton screens, and optimistic UI patterns
        </p>
        <PendingActionsIndicator className="mt-4 inline-flex" showDetails />
      </div>

      <Tabs defaultValue="loading" className="w-full"
          {...({ settings } as any)}
        >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="loading">Loading Components</TabsTrigger>
          <TabsTrigger value="skeletons">Skeleton Screens</TabsTrigger>
          <TabsTrigger value="optimistic">Optimistic UI</TabsTrigger>
        </TabsList>

        {/* Loading Components Tab */}
        <TabsContent value="loading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Loading Spinners & Indicators
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Spinners */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Spinners</h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="text-center">
                    <LoadingSpinner size="sm" />
                    <p className="text-sm text-muted-foreground mt-1">Small</p>
                  </div>
                  <div className="text-center">
                    <LoadingSpinner size="md" />
                    <p className="text-sm text-muted-foreground mt-1">Medium</p>
                  </div>
                  <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="text-sm text-muted-foreground mt-1">Large</p>
                  </div>
                  <div className="text-center">
                    <LoadingSpinner size="xl" />
                    <p className="text-sm text-muted-foreground mt-1">Extra Large</p>
                  </div>
                </div>
              </div>

              {/* Alternative Loaders */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Alternative Loaders</h3>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-center">
                    <LoadingDots />
                    <p className="text-sm text-muted-foreground mt-1">Dots</p>
                  </div>
                  <div className="text-center">
                    <PulseLoader />
                    <p className="text-sm text-muted-foreground mt-1">Pulse</p>
                  </div>
                  <div className="text-center">
                    <SkeletonLoader />
                    <p className="text-sm text-muted-foreground mt-1">Skeleton</p>
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Progress Indicators</h3>
                <div className="space-y-4 max-w-md">
                  <ProgressIndicator progress={progress} />
                  <ProgressIndicator 
                    progress={progress} 
                    showPercentage 
                    label="Upload Progress"
                  />
                  <Button onClick={startProgress} disabled={isLoading}>
                    {isLoading ? 'Processing...' : 'Start Progress Demo'}
                  </Button>
                </div>
              </div>

              {/* Loading Buttons */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Loading Buttons</h3>
                <div className="flex gap-3 flex-wrap">
                  <LoadingButton loading={isLoading}>
                    Default Button
                  </LoadingButton>
                  <LoadingButton loading={isLoading}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </LoadingButton>
                  <LoadingButton loading={isLoading}>
                    Delete Item
                  </LoadingButton>
                  <LoadingButton loading={isLoading}>
                    Small Button
                  </LoadingButton>
                </div>
              </div>

              {/* Status Indicators */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Status Indicators</h3>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <StatusIndicator status="loading" />
                    <span className="text-sm">Processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status="success" />
                    <span className="text-sm">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status="error" />
                    <span className="text-sm">Failed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status="idle" />
                    <span className="text-sm">Idle</span>
                  </div>
                </div>
              </div>

              {/* Loading Overlay */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Loading Overlay</h3>
                <div className="relative">
                  <Button onClick={toggleOverlay}>
                    Toggle Loading Overlay
                  </Button>
                  {showOverlay && (
                    <LoadingOverlay loading={true}>
                      Processing your request...
                    </LoadingOverlay>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skeleton Screens Tab */}
        <TabsContent value="skeletons" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Skeleton Screens Demo</CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSkeletonDemo(true)}
                >
                  Show Skeletons
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSkeletonDemo(false)}
                >
                  Show Content
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Table Skeleton */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Table</h3>
                  {skeletonDemo ? (
                    <TableSkeleton rows={4} columns={3} />
                  ) : (
                    <div className="border rounded">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2">John Doe</td>
                            <td className="p-2"><Badge>Active</Badge></td>
                            <td className="p-2">2024-01-15</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2">Jane Smith</td>
                            <td className="p-2"><Badge variant="secondary">Inactive</Badge></td>
                            <td className="p-2">2024-01-14</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Card Skeleton */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Cards</h3>
                  {skeletonDemo ? (
                    <CardSkeleton />
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>Sample Card</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p>This is sample card content that would normally be loaded from an API.</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* List Skeleton */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Lists</h3>
                  {skeletonDemo ? (
                    <ListSkeleton items={4} />
                  ) : (
                    <div className="space-y-2">
                      {['Item 1', 'Item 2', 'Item 3', 'Item 4'].map(item => (
                        <div key={item} className="p-2 border rounded">
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chart Skeleton */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Charts</h3>
                  {skeletonDemo ? (
                    <ChartSkeleton />
                  ) : (
                    <div className="p-4 border rounded bg-muted/50 text-center">
                      <p className="text-muted-foreground">Chart would be rendered here</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Skeleton */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Form</h3>
                {skeletonDemo ? (
                  <FormSkeleton fields={3} />
                ) : (
                  <div className="space-y-4 max-w-md">
                    <Input placeholder="Name" />
                    <Input placeholder="Email" type="email" />
                    <Input placeholder="Message" />
                    <Button>Submit</Button>
                  </div>
                )}
              </div>

              {/* Profile Skeleton */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Profile</h3>
                {skeletonDemo ? (
                  <ProfileSkeleton />
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                      JD
                    </div>
                    <div>
                      <h4 className="font-semibold">John Doe</h4>
                      <p className="text-muted-foreground">john.doe@example.com</p>
                      <Badge variant="outline">Premium User</Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimistic UI Tab */}
        <TabsContent value="optimistic" className="space-y-6">
          {/* Counter Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Optimistic Counter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OptimisticCounter
                initialValue={42}
                onIncrement={() => mockCounterApi(true)}
                onDecrement={() => mockCounterApi(false)}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Click the buttons to see instant feedback with server confirmation
              </p>
            </CardContent>
          </Card>

          {/* Like Button Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Optimistic Like Button
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OptimisticLikeButton
                itemId="demo-item"
                initialLiked={false}
                initialCount={23}
                onToggle={mockLikeApi}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Like this item to see optimistic UI in action
              </p>
            </CardContent>
          </Card>

          {/* Form Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Save className="w-5 h-5" />
                Optimistic Form
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OptimisticForm
                onSubmit={async (data) => {
                  await mockApiCall(1200);
                  return { success: true, data };
                }}
                showPreview={true}
              >
                <Input name="title" placeholder="Title" />
                <Input name="description" placeholder="Description" />
              </OptimisticForm>
            </CardContent>
          </Card>

          {/* Comments Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Optimistic Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OptimisticComments
                initialComments={mockComments}
                onAddComment={mockCommentApi}
                onDeleteComment={async (id) => {
                  await mockApiCall(500);
                }}
              />
            </CardContent>
          </Card>

          {/* Action Status Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Action Status Indicators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <ActionStatus actionId="pending-action" showRetry showRollback />
                <Badge variant="outline">
                  Sample pending action
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Action statuses will appear here when you interact with optimistic UI components above
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
