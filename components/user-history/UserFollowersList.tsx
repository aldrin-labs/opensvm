/**
 * User Followers List Component
 * Shows followers and following lists with navigation
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Follower {
  walletAddress: string;
  timestamp: number;
}

interface UserFollowersListProps {
  walletAddress: string;
  type: 'followers' | 'following';
}

export function UserFollowersList({ walletAddress, type }: UserFollowersListProps) {
  const [users, setUsers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`/api/user-social/follow/${walletAddress}?type=${type}`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data[type] || []);
        } else {
          console.warn(`Failed to fetch ${type} data:`, response.status);
          setUsers([]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [walletAddress, type]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {type === 'followers' ? 'Followers' : 'Following'} ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No {type} yet
          </p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <Link
                key={user.walletAddress}
                href={`/user/${user.walletAddress}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {formatAddress(user.walletAddress)[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{formatAddress(user.walletAddress)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(user.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
