import { withLedgerScope } from '@/lib/ledger-scope';
import { recognizedTransactionsWhere } from '@/lib/fixed-expense-schedule';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveCategoryInfo, classifyTransactionRole } from '@/lib/household-categories';
import { getHouseholdCategories } from '@/lib/household-categories-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handleGET(request: NextRequest) {
  try {
    const { categories } = await getHouseholdCategories();
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month'; // 'year' | 'month' | 'day'
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentDate = `${currentMonth}-${String(now.getDate()).padStart(2, '0')}`;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. 연별 통계 (period === 'year')
    // ─────────────────────────────────────────────────────────────────────────
    if (period === 'year') {
      const yearStr = searchParams.get('year') || String(currentYear);
      const year = parseInt(yearStr, 10) || currentYear;

      const startDate = new Date(`${year}-01-01T00:00:00+09:00`);
      const endDate = new Date(`${year}-12-31T23:59:59.999+09:00`);

      const txs = await prisma.cardTransaction.findMany({
        where: { ...recognizedTransactionsWhere(), notifiedAt: { gte: startDate, lte: endDate } },
        select: {
          id: true,
          amount: true,
          type: true,
          category: true,
          merchant: true,
          title: true,
          content: true,
          sourceApp: true,
          notifiedAt: true,
        },
      });

      // 12개월 집계 초기화
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const padM = String(m).padStart(2, '0');
        return {
          month: `${m}월`,
          monthNum: m,
          monthStr: `${year}-${padM}`,
          expense: 0, // 순수 소비 지출 (지출은 통제하고)
          income: 0,  // 수입 (수입은 늘리고)
          savings: 0, // 저축·투자 (저축은 꾸준하게)
          balance: 0, // 순자산 증가 = income - expense (자산 증식 목표)
          count: 0,
        };
      });

      let totalExpense = 0; // 순수 소비 지출 합계
      let totalIncome = 0;
      let totalSavings = 0;
      let totalTransfer = 0;
      const categoryMap = new Map<string, { amount: number; count: number }>();
      const savingsMap = new Map<string, { amount: number; count: number }>();
      const merchantMap = new Map<string, { amount: number; count: number }>();

      for (const t of txs) {
        const d = new Date(t.notifiedAt);
        // KST 기준 월 인덱스 (0~11)
        const kstTime = new Date(d.getTime() + 9 * 3600 * 1000);
        const mIdx = kstTime.getUTCMonth();
        const role = classifyTransactionRole(t, categories);

        if (role === 'INCOME') {
          monthlyData[mIdx].income += t.amount;
          totalIncome += t.amount;
        } else if (role === 'SAVINGS') {
          monthlyData[mIdx].savings += t.amount;
          totalSavings += t.amount;

          const cat = t.category || '저축';
          const sData = savingsMap.get(cat) || { amount: 0, count: 0 };
          sData.amount += t.amount;
          sData.count++;
          savingsMap.set(cat, sData);
        } else if (role === 'TRANSFER') {
          totalTransfer += t.amount;
        } else if (role === 'CONSUMPTION') {
          if (t.type === 'CANCEL') {
            monthlyData[mIdx].expense = Math.max(0, monthlyData[mIdx].expense - t.amount);
            totalExpense = Math.max(0, totalExpense - t.amount);
          } else {
            monthlyData[mIdx].expense += t.amount;
            totalExpense += t.amount;

            // 카테고리 집계 (순수 소비만)
            const cat = t.category || 'OTHER';
            const cData = categoryMap.get(cat) || { amount: 0, count: 0 };
            cData.amount += t.amount;
            cData.count++;
            categoryMap.set(cat, cData);

            // 가맹점 집계
            const mName = t.merchant || '미지정 가맹점';
            const mData = merchantMap.get(mName) || { amount: 0, count: 0 };
            mData.amount += t.amount;
            mData.count++;
            merchantMap.set(mName, mData);
          }
        }

        monthlyData[mIdx].count++;
      }

      // 월별 수지차액 (수입 - 순수 소비 지출 = 자산 순증가)
      for (const m of monthlyData) {
        m.balance = m.income - m.expense;
      }

      // 카테고리 랭킹 (순수 소비)
      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([code, data]) => {
          const info = resolveCategoryInfo(code);
          return {
            code,
            name: info.label,
            color: info.color,
            amount: data.amount,
            count: data.count,
            percentage: totalExpense > 0 ? Number(((data.amount / totalExpense) * 100).toFixed(1)) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      // 저축·투자 분류 랭킹
      const savingsBreakdown = Array.from(savingsMap.entries())
        .map(([code, data]) => {
          const info = resolveCategoryInfo(code);
          return {
            code,
            name: info.label,
            color: info.color,
            amount: data.amount,
            count: data.count,
            percentage: totalSavings > 0 ? Number(((data.amount / totalSavings) * 100).toFixed(1)) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      // 상위 가맹점 Top 10
      const topMerchants = Array.from(merchantMap.entries())
        .map(([merchant, data]) => ({
          merchant,
          amount: data.amount,
          count: data.count,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // 활동 월 수 (지출이나 수입이 발생한 개월 수)
      const activeMonthsCount = monthlyData.filter((m) => m.count > 0).length || 1;
      const monthlyAvgExpense = Math.round(totalExpense / activeMonthsCount);
      const monthlyAvgSavings = Math.round(totalSavings / activeMonthsCount);

      // 피크 소비 월
      const peakMonth = [...monthlyData].sort((a, b) => b.expense - a.expense)[0];
      const savingsRate = totalIncome > 0 ? Number(((totalSavings / totalIncome) * 100).toFixed(1)) : 0;
      const netAssetGrowth = totalIncome - totalExpense;

      return NextResponse.json({
        success: true,
        period: 'year',
        year,
        totalExpense, // 순수 소비 지출 (저축 제외)
        consumptionExpense: totalExpense,
        totalIncome, // 수입은 늘리고
        totalSavings, // 저축은 꾸준하게
        savingsRate, // 저축률 (%)
        netAssetGrowth, // 자산 증식 목표 (수입 - 소비)
        netBalance: netAssetGrowth,
        totalTransfer, // 내부 이체/카드대금
        monthlyAvgExpense,
        monthlyAvgSavings,
        totalTransactions: txs.length,
        activeMonthsCount,
        peakMonth,
        monthlyData,
        categoryBreakdown,
        savingsBreakdown,
        topMerchants,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. 월별 통계 (period === 'month')
    // ─────────────────────────────────────────────────────────────────────────
    if (period === 'month') {
      const monthStr = searchParams.get('month') || currentMonth;
      if (!/^\d{4}-\d{2}$/.test(monthStr)) {
        return NextResponse.json({ error: '올바른 month 형식(YYYY-MM)이 아닙니다.' }, { status: 400 });
      }

      const [yStr, mStr] = monthStr.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const lastDay = new Date(y, m, 0).getDate();
      const padM = String(m).padStart(2, '0');

      const startDate = new Date(`${y}-${padM}-01T00:00:00+09:00`);
      const endDate = new Date(`${y}-${padM}-${String(lastDay).padStart(2, '0')}T23:59:59.999+09:00`);

      // 전월 날짜 범위 (MoM 비교용)
      const prevY = m === 1 ? y - 1 : y;
      const prevM = m === 1 ? 12 : m - 1;
      const prevPadM = String(prevM).padStart(2, '0');
      const prevLastDay = new Date(prevY, prevM, 0).getDate();
      const prevStartDate = new Date(`${prevY}-${prevPadM}-01T00:00:00+09:00`);
      const prevEndDate = new Date(`${prevY}-${prevPadM}-${String(prevLastDay).padStart(2, '0')}T23:59:59.999+09:00`);

      const [txs, prevTxs] = await Promise.all([
        prisma.cardTransaction.findMany({
          where: { ...recognizedTransactionsWhere(), notifiedAt: { gte: startDate, lte: endDate } },
          select: {
            id: true,
            amount: true,
            type: true,
            category: true,
            merchant: true,
            title: true,
            content: true,
            sourceApp: true,
            cardOrAccount: true,
            notifiedAt: true,
          },
          orderBy: { notifiedAt: 'desc' },
        }),
        prisma.cardTransaction.findMany({
          where: { ...recognizedTransactionsWhere(), notifiedAt: { gte: prevStartDate, lte: prevEndDate } },
          select: {
            amount: true,
            type: true,
            category: true,
            title: true,
            merchant: true,
            content: true,
          },
        }),
      ]);

      // 일별 배열 초기화
      const dailyData = Array.from({ length: lastDay }, (_, i) => {
        const d = i + 1;
        const padD = String(d).padStart(2, '0');
        return {
          day: `${d}일`,
          dayNum: d,
          dateStr: `${y}-${padM}-${padD}`,
          expense: 0, // 순수 소비 지출
          income: 0,
          savings: 0, // 저축·투자
          count: 0,
          txs: [] as any[],
        };
      });

      let totalExpense = 0; // 순수 소비 지출 합계 (목표 예산 진행률 산출용)
      let totalIncome = 0;
      let totalSavings = 0;
      let totalTransfer = 0;
      let weekdayExpense = 0;
      let weekendExpense = 0;

      const categoryMap = new Map<string, { amount: number; count: number }>();
      const savingsMap = new Map<string, { amount: number; count: number }>();
      const merchantMap = new Map<string, { amount: number; count: number }>();
      const appMap = new Map<string, { amount: number; count: number }>();

      for (const t of txs) {
        const d = new Date(t.notifiedAt);
        const kstTime = new Date(d.getTime() + 9 * 3600 * 1000);
        const dayIdx = kstTime.getUTCDate() - 1;
        const dayOfWeek = kstTime.getUTCDay(); // 0(일) ~ 6(토)
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const role = classifyTransactionRole(t, categories);

        if (dayIdx >= 0 && dayIdx < lastDay) {
          dailyData[dayIdx].txs.push(t);
          if (role === 'INCOME') {
            dailyData[dayIdx].income += t.amount;
            totalIncome += t.amount;
          } else if (role === 'SAVINGS') {
            dailyData[dayIdx].savings += t.amount;
            totalSavings += t.amount;

            const cat = t.category || '저축';
            const sData = savingsMap.get(cat) || { amount: 0, count: 0 };
            sData.amount += t.amount;
            sData.count++;
            savingsMap.set(cat, sData);
          } else if (role === 'TRANSFER') {
            totalTransfer += t.amount;
          } else if (role === 'CONSUMPTION') {
            if (t.type === 'CANCEL') {
              dailyData[dayIdx].expense = Math.max(0, dailyData[dayIdx].expense - t.amount);
              totalExpense = Math.max(0, totalExpense - t.amount);
            } else {
              dailyData[dayIdx].expense += t.amount;
              totalExpense += t.amount;
              if (isWeekend) weekendExpense += t.amount;
              else weekdayExpense += t.amount;

              // 카테고리 집계 (순수 소비만)
              const cat = t.category || 'OTHER';
              const cData = categoryMap.get(cat) || { amount: 0, count: 0 };
              cData.amount += t.amount;
              cData.count++;
              categoryMap.set(cat, cData);

              // 가맹점 집계
              const mName = t.merchant || '미지정 가맹점';
              const mData = merchantMap.get(mName) || { amount: 0, count: 0 };
              mData.amount += t.amount;
              mData.count++;
              merchantMap.set(mName, mData);

              // 결제수단 집계
              const app = t.sourceApp || 'OTHER';
              const aData = appMap.get(app) || { amount: 0, count: 0 };
              aData.amount += t.amount;
              aData.count++;
              appMap.set(app, aData);
            }
          }

          dailyData[dayIdx].count++;
        }
      }

      // 전월 순수 소비 지출 집계 (저축 및 이체 제외)
      let prevTotalExpense = 0;
      for (const pt of prevTxs) {
        const role = classifyTransactionRole(pt, categories);
        if (role === 'CONSUMPTION') {
          if (pt.type === 'CANCEL') prevTotalExpense = Math.max(0, prevTotalExpense - pt.amount);
          else prevTotalExpense += pt.amount;
        }
      }

      const momDiffAmount = totalExpense - prevTotalExpense;
      const momDiffRate =
        prevTotalExpense > 0 ? Number(((momDiffAmount / prevTotalExpense) * 100).toFixed(1)) : 0;

      // 카테고리 랭킹 (순수 소비)
      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([code, data]) => {
          const info = resolveCategoryInfo(code);
          return {
            code,
            name: info.label,
            color: info.color,
            amount: data.amount,
            count: data.count,
            percentage: totalExpense > 0 ? Number(((data.amount / totalExpense) * 100).toFixed(1)) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      // 저축·투자 분류 랭킹
      const savingsBreakdown = Array.from(savingsMap.entries())
        .map(([code, data]) => {
          const info = resolveCategoryInfo(code);
          return {
            code,
            name: info.label,
            color: info.color,
            amount: data.amount,
            count: data.count,
            percentage: totalSavings > 0 ? Number(((data.amount / totalSavings) * 100).toFixed(1)) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      // 상위 가맹점 Top 5
      const topMerchants = Array.from(merchantMap.entries())
        .map(([merchant, data]) => ({
          merchant,
          amount: data.amount,
          count: data.count,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // 결제수단 비중
      const appBreakdown = Array.from(appMap.entries())
        .map(([sourceApp, data]) => ({
          sourceApp,
          amount: data.amount,
          count: data.count,
          percentage: totalExpense > 0 ? Number(((data.amount / totalExpense) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      // 피크 일
      const peakDay = [...dailyData].sort((a, b) => b.expense - a.expense)[0];
      const dailyAvgExpense = Math.round(totalExpense / lastDay);
      const savingsRate = totalIncome > 0 ? Number(((totalSavings / totalIncome) * 100).toFixed(1)) : 0;
      const netAssetGrowth = totalIncome - totalExpense;

      return NextResponse.json({
        success: true,
        period: 'month',
        month: monthStr,
        totalExpense, // 순수 소비 지출 (저축·투자 제외!)
        consumptionExpense: totalExpense,
        totalIncome, // 수입은 늘리고
        totalSavings, // 저축은 꾸준하게
        savingsRate, // 저축률 (%)
        netAssetGrowth, // 자산 증식 목표 (수입 - 소비 지출)
        netBalance: netAssetGrowth,
        totalTransfer, // 내부 이체/카드대금
        dailyAvgExpense,
        totalTransactions: txs.length,
        peakDay,
        momDiffAmount,
        momDiffRate,
        dailyData,
        categoryBreakdown,
        savingsBreakdown,
        topMerchants,
        appBreakdown,
        spendingPattern: {
          weekdayAmount: weekdayExpense,
          weekdayRate: totalExpense > 0 ? Number(((weekdayExpense / totalExpense) * 100).toFixed(1)) : 0,
          weekendAmount: weekendExpense,
          weekendRate: totalExpense > 0 ? Number(((weekendExpense / totalExpense) * 100).toFixed(1)) : 0,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. 일별 통계 (period === 'day')
    // ─────────────────────────────────────────────────────────────────────────
    if (period === 'day') {
      const dateStr = searchParams.get('date') || currentDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: '올바른 date 형식(YYYY-MM-DD)이 아닙니다.' }, { status: 400 });
      }

      const startDate = new Date(`${dateStr}T00:00:00+09:00`);
      const endDate = new Date(`${dateStr}T23:59:59.999+09:00`);

      // 해당 월의 전체 일자 스파크라인을 위해 월 범위도 함께 조회
      const monthPrefix = dateStr.slice(0, 7);
      const [yStr, mStr] = monthPrefix.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const lastDay = new Date(y, m, 0).getDate();
      const monthStart = new Date(`${monthPrefix}-01T00:00:00+09:00`);
      const monthEnd = new Date(`${monthPrefix}-${String(lastDay).padStart(2, '0')}T23:59:59.999+09:00`);

      const [dayTxs, monthTxs] = await Promise.all([
        prisma.cardTransaction.findMany({
          where: { ...recognizedTransactionsWhere(), notifiedAt: { gte: startDate, lte: endDate } },
          orderBy: { notifiedAt: 'asc' },
        }),
        prisma.cardTransaction.findMany({
          where: { ...recognizedTransactionsWhere(), notifiedAt: { gte: monthStart, lte: monthEnd } },
          select: {
            notifiedAt: true,
            amount: true,
            type: true,
            category: true,
            title: true,
            merchant: true,
            content: true,
          },
        }),
      ]);

      let dayExpense = 0; // 순수 소비
      let dayIncome = 0;
      let daySavings = 0;
      let dayTransfer = 0;

      const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}시`,
        hourNum: i,
        expense: 0,
        income: 0,
        savings: 0,
        count: 0,
      }));

      const categoryMap = new Map<string, { amount: number; count: number }>();
      const appMap = new Map<string, { amount: number; count: number }>();

      for (const t of dayTxs) {
        const d = new Date(t.notifiedAt);
        const kstTime = new Date(d.getTime() + 9 * 3600 * 1000);
        const h = kstTime.getUTCHours();
        const role = classifyTransactionRole(t, categories);

        if (role === 'INCOME') {
          dayIncome += t.amount;
          hourlyData[h].income += t.amount;
        } else if (role === 'SAVINGS') {
          daySavings += t.amount;
          hourlyData[h].savings += t.amount;
        } else if (role === 'TRANSFER') {
          dayTransfer += t.amount;
        } else if (role === 'CONSUMPTION') {
          if (t.type === 'CANCEL') {
            dayExpense = Math.max(0, dayExpense - t.amount);
            hourlyData[h].expense = Math.max(0, hourlyData[h].expense - t.amount);
          } else {
            dayExpense += t.amount;
            hourlyData[h].expense += t.amount;

            const cat = t.category || 'OTHER';
            const cData = categoryMap.get(cat) || { amount: 0, count: 0 };
            cData.amount += t.amount;
            cData.count++;
            categoryMap.set(cat, cData);

            const app = t.sourceApp || 'OTHER';
            const aData = appMap.get(app) || { amount: 0, count: 0 };
            aData.amount += t.amount;
            aData.count++;
            appMap.set(app, aData);
          }
        }

        hourlyData[h].count++;
      }

      // 월간 일별 스파크라인 타임라인
      const monthTimeline = Array.from({ length: lastDay }, (_, i) => {
        const d = i + 1;
        const padD = String(d).padStart(2, '0');
        return {
          day: `${d}일`,
          dayNum: d,
          dateStr: `${monthPrefix}-${padD}`,
          expense: 0,
          income: 0,
          savings: 0,
          count: 0,
          isSelected: `${monthPrefix}-${padD}` === dateStr,
        };
      });

      for (const t of monthTxs) {
        const d = new Date(t.notifiedAt);
        const kstTime = new Date(d.getTime() + 9 * 3600 * 1000);
        const dayIdx = kstTime.getUTCDate() - 1;
        if (dayIdx >= 0 && dayIdx < lastDay) {
          const role = classifyTransactionRole(t, categories);
          if (role === 'CONSUMPTION') {
            if (t.type === 'CANCEL') monthTimeline[dayIdx].expense = Math.max(0, monthTimeline[dayIdx].expense - t.amount);
            else monthTimeline[dayIdx].expense += t.amount;
          } else if (role === 'INCOME') {
            monthTimeline[dayIdx].income += t.amount;
          } else if (role === 'SAVINGS') {
            monthTimeline[dayIdx].savings += t.amount;
          }
          monthTimeline[dayIdx].count++;
        }
      }

      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([code, data]) => {
          const info = resolveCategoryInfo(code);
          return {
            code,
            name: info.label,
            color: info.color,
            amount: data.amount,
            count: data.count,
            percentage: dayExpense > 0 ? Number(((data.amount / dayExpense) * 100).toFixed(1)) : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      const savingsRate = dayIncome > 0 ? Number(((daySavings / dayIncome) * 100).toFixed(1)) : 0;
      const netAssetGrowth = dayIncome - dayExpense;

      return NextResponse.json({
        success: true,
        period: 'day',
        date: dateStr,
        totalExpense: dayExpense, // 순수 소비 지출
        consumptionExpense: dayExpense,
        totalIncome: dayIncome,
        totalSavings: daySavings,
        savingsRate,
        netAssetGrowth,
        netBalance: netAssetGrowth,
        totalTransfer: dayTransfer,
        totalTransactions: dayTxs.length,
        transactions: dayTxs,
        categoryBreakdown,
        hourlyData,
        monthTimeline,
      });
    }

    return NextResponse.json({ error: '올바른 period 파라미터가 아닙니다. (year, month, day 중 선택)' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/card-transactions/stats] Error:', error);
    return NextResponse.json(
      { error: error?.message || '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withLedgerScope(handleGET);
