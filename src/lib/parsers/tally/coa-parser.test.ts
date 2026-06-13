import { describe, expect, it } from 'vitest';
import { parseTallyCOA } from './coa-parser';

describe('parseTallyCOA stock item masters', () => {
  it('keeps WIPRO and WIPRO DIV as distinct stock items from one Tally upload', () => {
    const xml = `
      <ENVELOPE>
        <BODY>
          <IMPORTDATA>
            <REQUESTDATA>
              <TALLYMESSAGE>
                <STOCKITEM NAME="WIPRO">
                  <NAME.LIST><NAME>WIPRO</NAME></NAME.LIST>
                  <BASEUNITS>NOS</BASEUNITS>
                </STOCKITEM>
              </TALLYMESSAGE>
              <TALLYMESSAGE>
                <STOCKITEM NAME="WIPRO DIV">
                  <NAME.LIST><NAME>WIPRO DIV</NAME></NAME.LIST>
                  <BASEUNITS>NOS</BASEUNITS>
                </STOCKITEM>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;

    const parsed = parseTallyCOA(xml);

    expect(parsed.stockItems.map((item) => item.name).sort()).toEqual([
      'WIPRO',
      'WIPRO DIV',
    ]);
  });
});
