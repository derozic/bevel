import 'package:bevel_app/native/sms_life_index.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('classifySms', () {
    test('drops OTPs and short codes', () {
      expect(
        classifySms(
          id: '1',
          address: '33456',
          body: '482193',
          ts: 1,
          isFromMe: false,
        ).signal,
        SmsSignal.noise,
      );
      expect(
        classifySms(
          id: '2',
          address: '+15551234567',
          body: 'Your verification code is 441920. Do not share.',
          ts: 1,
          isFromMe: false,
        ).signal,
        SmsSignal.noise,
      );
    });

    test('marks hospital / death as critical life moments', () {
      final hospital = classifySms(
        id: '3',
        address: '+15550001111',
        body: 'We are at the hospital. Call when you can.',
        ts: 1,
        isFromMe: false,
      );
      expect(hospital.signal, SmsSignal.critical);
      expect(hospital.tags, contains('emergency'));
      expect(hospital.matters, isTrue);

      final death = classifySms(
        id: '4',
        address: '+15550002222',
        body: 'Grandma passed away this morning.',
        ts: 2,
        isFromMe: false,
      );
      expect(death.signal, SmsSignal.critical);
      expect(death.tags, contains('death'));
    });

    test('marks landed / job offer as life, not noise', () {
      expect(
        classifySms(
          id: '5',
          address: '+15550003333',
          body: 'Just landed in Detroit.',
          ts: 3,
          isFromMe: true,
        ).tags,
        contains('travel'),
      );
      expect(
        classifySms(
          id: '6',
          address: '+15550004444',
          body: 'They sent the job offer. I accepted the offer.',
          ts: 4,
          isFromMe: false,
        ).signal,
        SmsSignal.life,
      );
    });

    test('ordinary chatter is not a life moment', () {
      expect(
        classifySms(
          id: '7',
          address: '+15550005555',
          body: 'Want Thai or pizza?',
          ts: 5,
          isFromMe: false,
        ).matters,
        isFalse,
      );
    });
  });
}
