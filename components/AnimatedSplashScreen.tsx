import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import COLORS from '../theme/colors';

const ANIMATION = {
  totalDuration: 1900,
  openingDuration: 720,
  fadeOutDuration: 240,
};

// Mantém a splash nativa visível até que a camada animada esteja pronta.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function AnimatedSplashScreen() {
  const [visible, setVisible] = useState(true);
  const hasStarted = useRef(false);
  const [animationValues] = useState(() => ({
    overlayOpacity: new Animated.Value(1),
    bookOpacity: new Animated.Value(0),
    bookScale: new Animated.Value(0.86),
    opening: new Animated.Value(0),
    glowOpacity: new Animated.Value(0),
    nameOpacity: new Animated.Value(0),
    nameTranslateY: new Animated.Value(10),
    sloganOpacity: new Animated.Value(0),
    sloganTranslateY: new Animated.Value(8),
  }));
  const {
    overlayOpacity,
    bookOpacity,
    bookScale,
    opening,
    glowOpacity,
    nameOpacity,
    nameTranslateY,
    sloganOpacity,
    sloganTranslateY,
  } = animationValues;

  const startAnimation = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    void SplashScreen.hideAsync().catch(() => undefined);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(bookOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(bookScale, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // A largura cresce a partir da lombada para evitar a deformação em “L”.
        Animated.timing(opening, {
          toValue: 1,
          duration: ANIMATION.openingDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(620),
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 0.62,
              duration: 240,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.28,
              duration: 360,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(700),
          Animated.parallel([
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 420,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(nameTranslateY, {
              toValue: 0,
              duration: 420,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(1120),
          Animated.parallel([
            Animated.timing(sloganOpacity, {
              toValue: 1,
              duration: 360,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(sloganTranslateY, {
              toValue: 0,
              duration: 360,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.delay(
        Math.max(
          0,
          ANIMATION.totalDuration - 1120 - 360 - ANIMATION.fadeOutDuration
        )
      ),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: ANIMATION.fadeOutDuration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [
    bookOpacity,
    bookScale,
    glowOpacity,
    nameOpacity,
    nameTranslateY,
    opening,
    overlayOpacity,
    sloganOpacity,
    sloganTranslateY,
  ]);

  const pageWidth = opening.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 58],
  });
  const pageLineOpacity = opening.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 0.65],
  });

  return (
    <>
      <StatusBar style={visible ? 'light' : 'dark'} />
      {visible ? (
        <Animated.View
          onLayout={startAnimation}
          pointerEvents="auto"
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <View style={styles.content}>
            <Animated.View
              style={[
                styles.bookMark,
                {
                  opacity: bookOpacity,
                  transform: [{ scale: bookScale }],
                },
              ]}
            >
              <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
              <View style={styles.book}>
                <Animated.View
                  style={[styles.page, styles.leftPage, { width: pageWidth }]}
                >
                  <Animated.View style={[styles.pageLine, { opacity: pageLineOpacity }]} />
                  <Animated.View style={[styles.pageLine, styles.shortPageLine, { opacity: pageLineOpacity }]} />
                  <Animated.View style={[styles.pageLine, styles.shortPageLine, { opacity: pageLineOpacity }]} />
                </Animated.View>
                <Animated.View
                  style={[styles.page, styles.rightPage, { width: pageWidth }]}
                >
                  <Animated.View style={[styles.pageLine, { opacity: pageLineOpacity }]} />
                  <Animated.View style={[styles.pageLine, styles.shortPageLine, { opacity: pageLineOpacity }]} />
                  <Animated.View style={[styles.pageLine, styles.shortPageLine, { opacity: pageLineOpacity }]} />
                </Animated.View>
                <View style={styles.spine} />
              </View>
            </Animated.View>

            <Animated.Text
              style={[
                styles.name,
                {
                  opacity: nameOpacity,
                  transform: [{ translateY: nameTranslateY }],
                },
              ]}
            >
              Bentora
            </Animated.Text>

            <Animated.Text
              style={[
                styles.slogan,
                {
                  opacity: sloganOpacity,
                  transform: [{ translateY: sloganTranslateY }],
                },
              ]}
            >
              Leia. Reflita. Guarde o que importa.
            </Animated.Text>
          </View>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bookMark: {
    width: 150,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  glow: {
    position: 'absolute',
    width: 142,
    height: 100,
    borderRadius: 70,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.7,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  book: {
    position: 'relative',
    width: 116,
    height: 82,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  page: {
    position: 'absolute',
    bottom: 5,
    height: 72,
    backgroundColor: COLORS.backgroundLight,
    borderColor: COLORS.gold,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 7,
    overflow: 'hidden',
  },
  leftPage: {
    right: '50%',
    borderLeftWidth: 2,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 4,
    alignItems: 'flex-end',
  },
  rightPage: {
    left: '50%',
    borderRightWidth: 2,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 4,
    alignItems: 'flex-start',
  },
  pageLine: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.cream,
  },
  shortPageLine: {
    width: '72%',
  },
  spine: {
    position: 'absolute',
    width: 2,
    height: 74,
    alignSelf: 'center',
    top: 5,
    backgroundColor: COLORS.gold,
    opacity: 0.9,
  },
  name: {
    marginTop: 8,
    color: COLORS.cream,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 38,
    letterSpacing: 1.2,
    lineHeight: 48,
  },
  slogan: {
    marginTop: 8,
    color: COLORS.gold,
    fontSize: 13,
    letterSpacing: 0.7,
    textAlign: 'center',
  },
});
