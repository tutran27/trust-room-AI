'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from '@trustroom/ui';
import { AppShell } from '../../../components/app-shell';
import { AuthGate } from '../../../components/auth-gate';
import { useAnalyzeDeal, useCreateDeal } from '../../../hooks/use-api';

type CreateDealForm = {
  title: string;
  description: string;
  type: 'freelance_service' | 'nft' | 'token_otc' | 'digital_goods' | 'domain' | 'other';
  amount: string;
  token: 'SOL' | 'USDC' | 'SPL_TOKEN';
  deadline: string;
  sellerWallet: string;
};

const DEAL_TYPE_OPTIONS = [
  { label: 'Freelance service', value: 'freelance_service' },
  { label: 'NFT', value: 'nft' },
  { label: 'Token OTC', value: 'token_otc' },
  { label: 'Digital goods', value: 'digital_goods' },
  { label: 'Domain', value: 'domain' },
  { label: 'Other', value: 'other' },
] as const;

const TOKEN_OPTIONS = [
  { label: 'USDC', value: 'USDC' },
  { label: 'SOL', value: 'SOL' },
  { label: 'SPL Token', value: 'SPL_TOKEN' },
] as const;

export default function CreateDealPage() {
  const router = useRouter();
  const createDeal = useCreateDeal();
  const analyzeDeal = useAnalyzeDeal();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CreateDealForm>({
    defaultValues: {
      title: '',
      description: '',
      type: 'freelance_service',
      amount: '100',
      token: 'USDC',
      deadline: '',
      sellerWallet: '',
    },
  });

  const descriptionValue = form.watch('description');
  const aiSummary = useMemo(() => analyzeDeal.data, [analyzeDeal.data]);

  return (
    <AuthGate>
      <AppShell
        title="Tạo deal mới"
        subtitle="Tạo một deal demo-ready, kiểm tra rủi ro sơ bộ bằng AI và mời seller ngay từ bước đầu nếu đã có wallet."
        actions={
          <Link href="/dashboard">
            <Button variant="ghost">Quay lại dashboard</Button>
          </Link>
        }
      >
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Thông tin deal</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-5"
                onSubmit={form.handleSubmit(async (values) => {
                  setSubmitError(null);
                  try {
                    const created = await createDeal.mutateAsync({
                      title: values.title,
                      description: values.description || undefined,
                      type: values.type,
                      amount: values.amount,
                      token: values.token,
                      deadline: values.deadline || undefined,
                      sellerWallet: values.sellerWallet || undefined,
                    });
                    router.push(`/deals/${created.id}`);
                  } catch (error) {
                    setSubmitError(error instanceof Error ? error.message : 'Không thể tạo deal.');
                  }
                })}
              >
                <div className="grid gap-2">
                  <Label htmlFor="title">Tiêu đề deal</Label>
                  <Input
                    id="title"
                    placeholder="Ví dụ: OTC 5,000 USDC cho dịch vụ thiết kế"
                    {...form.register('title', { required: true })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Textarea
                    id="description"
                    rows={6}
                    placeholder="Mô tả rõ deliverable, điều kiện release, deadline, các điểm dễ tranh chấp…"
                    {...form.register('description')}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Loại deal</Label>
                    <Select id="type" options={DEAL_TYPE_OPTIONS as any} {...form.register('type')} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="token">Token</Label>
                    <Select id="token" options={TOKEN_OPTIONS as any} {...form.register('token')} />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Số tiền</Label>
                    <Input id="amount" placeholder="1000" {...form.register('amount', { required: true })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input id="deadline" type="datetime-local" {...form.register('deadline')} />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sellerWallet">Seller wallet (tuỳ chọn)</Label>
                  <Input
                    id="sellerWallet"
                    placeholder="Base58 wallet của seller"
                    {...form.register('sellerWallet')}
                  />
                </div>

                {submitError ? (
                  <Alert variant="danger" title="Không thể tạo deal">
                    {submitError}
                  </Alert>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={createDeal.isPending}>
                    {createDeal.isPending ? 'Đang tạo…' : 'Tạo deal'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!descriptionValue || analyzeDeal.isPending}
                    onClick={() => analyzeDeal.mutate({ dealDescription: descriptionValue })}
                  >
                    {analyzeDeal.isPending ? 'Đang phân tích…' : 'AI review mô tả'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI pre-flight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-300">
                Đây là review nhanh trước khi deal được publish. Nó giúp bạn phát hiện mô tả mơ hồ,
                điều khoản thiếu, hoặc risk wording từ rất sớm.
              </p>

              {aiSummary ? (
                <>
                  <Alert
                    variant={
                      aiSummary.risk.level === 'high' || aiSummary.risk.level === 'critical'
                        ? 'danger'
                        : aiSummary.risk.level === 'medium'
                          ? 'warning'
                          : 'success'
                    }
                    title={`Risk level: ${aiSummary.risk.level ?? 'unknown'}`}
                  >
                    Score: {aiSummary.risk.score ?? '—'} | Recommendation:{' '}
                    {aiSummary.risk.recommendation ?? 'N/A'}
                  </Alert>
                  <pre className="overflow-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-xs text-slate-300">
                    {JSON.stringify(aiSummary.terms, null, 2)}
                  </pre>
                </>
              ) : (
                <Alert title="Chưa phân tích">
                  Nhấn <strong>AI review mô tả</strong> để lấy terms extraction và risk snapshot.
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
