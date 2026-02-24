import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const yearMonth = searchParams.get('yearMonth')

        if (!yearMonth) {
            return NextResponse.json({ error: 'yearMonth is required' }, { status: 400 })
        }

        // Fetch all shift requests for the given month
        const shiftRequests = await prisma.shiftRequest.findMany({
            where: { yearMonth },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        employeeCode: true,
                        jobType: true,
                    }
                },
                shiftEntries: {
                    orderBy: {
                        date: 'asc'
                    }
                }
            },
            orderBy: {
                employee: {
                    employeeCode: 'asc'
                }
            }
        })

        return NextResponse.json(shiftRequests)

    } catch (error) {
        console.error('Fetch shift requests error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch shift requests' },
            { status: 500 }
        )
    }
}
