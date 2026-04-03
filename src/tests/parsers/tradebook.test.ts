import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseTradebook } from '../../lib/parsers/zerodha/tradebook';

describe('parseTradebook', () => {
    it('parses a representative Zerodha tradebook CSV fixture', () => {
        const fixturePath = resolve(
            process.cwd(),
            'src/tests/fixtures/zerodha-tradebook-sample.csv',
        );
        const fileBuffer = readFileSync(fixturePath);

        const result = parseTradebook(fileBuffer, 'tradebook-sample.csv');

        expect(result.metadata.row_count).toBe(2);
        expect(result.metadata.date_range).toEqual({
            from: '2024-04-01',
            to: '2024-04-02',
        });

        expect(result.rows[0]).toMatchObject({
            trade_date: '2024-04-01',
            exchange: 'NSE',
            segment: 'EQ',
            symbol: 'INFY',
            isin: 'INE009A01021',
            trade_type: 'buy',
            quantity: '10',
            price: '1500.50',
            trade_id: 'T12345',
            order_id: 'O54321',
        });

        expect(result.rows[1]).toMatchObject({
            trade_type: 'sell',
            quantity: '5',
            price: '1550.00',
            trade_id: 'T12346',
        });
    });

    it('throws for invalid trade_type', () => {
        const invalidCsv = [
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Trade ID,Order ID,Order Execution Time',
            '2024-04-01,NSE,EQ,INFY,INE009A01021,HOLD,10,1500.50,T12345,O54321,2024-04-01 09:20:00',
        ].join('\n');

        expect(() => parseTradebook(Buffer.from(invalidCsv), 'invalid.csv')).toThrow(
            /Unexpected trade_type/i,
        );
    });

    it('maps Product column when present without changing required headers', () => {
        const csv = [
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2024-04-01,NSE,EQ,INFY,INE009A01021,BUY,10,1500.50,CNC,T12345,O54321,2024-04-01 09:20:00',
        ].join('\n');

        const result = parseTradebook(Buffer.from(csv), 'with-product.csv');

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toMatchObject({
            symbol: 'INFY',
            product: 'CNC',
            trade_type: 'buy',
        });
    });

    it('accepts BO and CO product codes', () => {
        const csv = [
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2024-04-01,NSE,EQ,INFY,INE009A01021,BUY,10,1500.50,BO,T12345,O54321,2024-04-01 09:20:00',
            '2024-04-01,NSE,EQ,INFY,INE009A01021,SELL,10,1510.00,CO,T12346,O54322,2024-04-01 09:30:00',
        ].join('\n');

        const result = parseTradebook(Buffer.from(csv), 'with-bo-co.csv');

        expect(result.rows[0].product).toBe('BO');
        expect(result.rows[1].product).toBe('CO');
    });

    it('throws for unsupported product codes when Product column is present', () => {
        const csv = [
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2024-04-01,NSE,EQ,INFY,INE009A01021,BUY,10,1500.50,XYZ,T12345,O54321,2024-04-01 09:20:00',
        ].join('\n');

        expect(() => parseTradebook(Buffer.from(csv), 'invalid-product.csv')).toThrow(
            /Unexpected product/i,
        );
    });

    it('keeps parsing older files when Product column is absent', () => {
        const csv = [
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Trade ID,Order ID,Order Execution Time',
            '2024-04-01,NSE,EQ,INFY,INE009A01021,BUY,10,1500.50,T12345,O54321,2024-04-01 09:20:00',
        ].join('\n');

        const result = parseTradebook(Buffer.from(csv), 'without-product.csv');

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].product).toBeUndefined();
        expect(result.rows[0]).toMatchObject({
            symbol: 'INFY',
            trade_type: 'buy',
            quantity: '10',
        });
    });
});
