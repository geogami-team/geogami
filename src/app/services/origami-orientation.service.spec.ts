import { OrigamiOrientationService } from './origami-orientation.service';

describe('OrigamiOrientationService', () => {
  let receiveDirection: (payload: any) => void;
  let headings: number[];

  beforeEach(async () => {
    const socket = {
      on: (_event: string, listener: (payload: any) => void) => receiveDirection = listener
    };
    const service = new OrigamiOrientationService(null, null, socket as any, null, null, null);
    await service.init(true);
    headings = [];
    service.avatarOrientationSubscription.subscribe(heading => headings.push(heading));
  });

  it('delivers the same numeric avatar heading for English and German clients', () => {
    receiveDirection({ angleValue: '123.45' });
    receiveDirection({ angleValue: '123,45' });
    receiveDirection({ angleValue: 123.45 });
    receiveDirection({ angleValue: '0' });
    expect(headings).toEqual([123.45, 123.45, 123.45, 0]);
  });

  it('ignores bad direction packets and continues receiving subsequent headings', () => {
    receiveDirection({ angleValue: '90,5' });
    for (const payload of [null, {}, { angleValue: '' }, { angleValue: 'NaN' }, { angleValue: Infinity }]) {
      receiveDirection(payload);
    }
    receiveDirection({ angleValue: '180,25' });
    expect(headings).toEqual([90.5, 180.25]);
  });
});
