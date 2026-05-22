import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getFmpProvider } from '@/lib/providers/fmp';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ticker } = await params;
    const upperTicker = ticker.toUpperCase();
    console.log('Profile endpoint called for:', upperTicker);

    const company = await prisma.company.findUnique({
      where: { ticker: upperTicker },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const fmp = getFmpProvider();
    if (!fmp) {
      return NextResponse.json(
        { error: 'FMP provider not configured' },
        { status: 500 }
      );
    }

    const profile = await fmp.fetchCompanyProfile(upperTicker);
    console.log('Profile data:', JSON.stringify(profile));
    if (!profile) {
      return NextResponse.json(
        { error: 'No profile data returned from FMP' },
        { status: 404 }
      );
    }

    const updatedCompany = await prisma.company.update({
      where: { id: company.id },
      data: {
        description: profile.description,
        industry: profile.industry,
        website: profile.website,
        ceo: profile.ceo,
        employees: profile.employees,
        ipoDate: profile.ipoDate ? new Date(profile.ipoDate) : null,
        logoUrl: profile.logoUrl,
        country: profile.country,
      },
    });

    return NextResponse.json({ success: true, company: updatedCompany });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company profile' },
      { status: 500 }
    );
  }
}
