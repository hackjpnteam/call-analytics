'use client';

import { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  User,
  Phone,
  Mail,
  Briefcase,
  FileText,
  Calendar,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface CustomerInfoProps {
  phoneNumber: string;
  children: React.ReactNode;
}

interface CustomerData {
  id: string;
  customerId: string;
  companyName: string;
  contactName: string;
  phoneNumber: string;
  email?: string;
  industry?: string;
  status: string;
  notes?: string;
  lastContactAt?: string;
}

export function CustomerInfo({ phoneNumber, children }: CustomerInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (isOpen && !customer && !notFound) {
      fetchCustomer();
    }
  }, [isOpen]);

  const fetchCustomer = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phoneNumber)}`);
      const data = await res.json();

      if (data.found) {
        setCustomer(data.customer);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    prospect: 'bg-blue-100 text-blue-800',
    lead: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="p-0 h-auto font-mono text-sm hover:text-blue-600 hover:underline"
        >
          {children}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">顧客情報を取得中...</span>
          </div>
        )}

        {notFound && !loading && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">顧客情報が見つかりません</p>
            <p className="text-xs text-gray-400 mt-1">{phoneNumber}</p>
          </div>
        )}

        {customer && !loading && (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-500" />
                  <span className="font-semibold">{customer.companyName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                  <User className="h-3 w-3" />
                  <span>{customer.contactName || '担当者未設定'}</span>
                </div>
              </div>
              <Badge className={statusColors[customer.status] || 'bg-gray-100'}>
                {customer.status}
              </Badge>
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-3 w-3" />
                <span>{customer.phoneNumber}</span>
              </div>

              {customer.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-3 w-3" />
                  <span>{customer.email}</span>
                </div>
              )}

              {customer.industry && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Briefcase className="h-3 w-3" />
                  <span>{customer.industry}</span>
                </div>
              )}

              {customer.lastContactAt && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-3 w-3" />
                  <span>最終連絡: {new Date(customer.lastContactAt).toLocaleDateString('ja-JP')}</span>
                </div>
              )}
            </div>

            {customer.notes && (
              <div className="border-t pt-3">
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="h-3 w-3 mt-1 text-gray-500" />
                  <p className="text-gray-600 line-clamp-3">{customer.notes}</p>
                </div>
              </div>
            )}

            <div className="border-t pt-3">
              <Button variant="outline" size="sm" className="w-full">
                <ExternalLink className="h-3 w-3 mr-2" />
                FileMakerで開く
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
