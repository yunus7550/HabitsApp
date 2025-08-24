import {
  client,
  COMPLETION_COLLECTION_ID,
  DATABASE_ID,
  databases,
  HABITS_COLLECTION_ID,
  RealtimeResponse,
} from "@/lib/appwrite";
import { useAuth } from "@/lib/auth-context";
import { Habit, HabitCompletion } from "@/types/databse.type";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Query } from "react-native-appwrite";
import { ScrollView } from "react-native-gesture-handler";
import { Card, Text } from "react-native-paper";

export default function StreaksScreen() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completeHabits, setCompleteHabits] = useState<HabitCompletion[]>();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const habitsChannel = `databases.${DATABASE_ID}.collections.${HABITS_COLLECTION_ID}.documents`;

      const unsubscribe = client.subscribe(
        habitsChannel,
        (response: RealtimeResponse) => {
          if (
            response.events.some(
              (event) =>
                event.includes("documents.*.create") ||
                event.includes("documents.*.update") ||
                event.includes("documents.*.delete")
            )
          ) {
            fetchHabits();
          }
        }
      );

      const completionsChannel = `databases.${DATABASE_ID}.collections.${COMPLETION_COLLECTION_ID}.documents`;

      const completionSubscription = client.subscribe(
        completionsChannel,
        (response: RealtimeResponse) => {
          if (
            response.events.some((event) =>
              event.includes("documents.*.create")
            )
          ) {
            fetchCompletions();
          }
        }
      );

      fetchHabits();
      fetchCompletions();

      return () => {
        unsubscribe();
        completionSubscription();
      };
    }
  }, [user]);

  const fetchHabits = async () => {
    try {
      const response = await databases.listDocuments<Habit>(
        DATABASE_ID,
        HABITS_COLLECTION_ID,
        [Query.equal("user_id", user?.$id ?? "")]
      );
      setHabits(response.documents as Habit[]);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCompletions = async () => {
    try {
      const response = await databases.listDocuments<HabitCompletion>(
        DATABASE_ID,
        COMPLETION_COLLECTION_ID,
        [Query.equal("user_id", user?.$id ?? "")]
      );

      const completions = response.documents as HabitCompletion[];
      setCompleteHabits(completions);
    } catch (error) {
      console.error(error);
    }
  };

  interface StreakData {
    streak: number;
    bestStreak: number;
    total: number;
  }

  const getStreakData = (habitId: string): StreakData => {
    const habitCompletions = completeHabits
      ?.filter((c) => c.habit_id === habitId)
      .sort(
        (a, b) =>
          new Date(a.completed_at).getTime() -
          new Date(b.completed_at).getTime()
      );

    if (!habitCompletions || habitCompletions.length === 0) {
      return { streak: 0, bestStreak: 0, total: 0 };
    }

    let streak = 0;
    let bestStreak = 0;
    let lastDate: Date | null = null;
    let currentStreak = 0;

    habitCompletions.forEach((c) => {
      const date = new Date(c.completed_at);
      if (lastDate) {
        const diff =
          (date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diff <= 1.5) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      if (currentStreak > bestStreak) bestStreak = currentStreak;
      streak = currentStreak;
      lastDate = date;
    });

    return {
      streak,
      bestStreak,
      total: habitCompletions.length,
    };
  };

  const habitStreak = habits.map((habit) => {
    const { streak, bestStreak, total } = getStreakData(habit.$id);
    return { habit, streak, bestStreak, total };
  });

  const rankedHabits = habitStreak.sort((a, b) => b.bestStreak - a.bestStreak);

  const badgeStyle = [styles.badge1, styles.badge2, styles.badge3];
  return (
    <View style={styles.container}>
      <Text style={styles.title} variant="headlineSmall">
        Habit Streaks
      </Text>

      {rankedHabits.length > 0 && (
        <View style={styles.rankingContainer}>
          <Text style={styles.rankingTitle}>🎖️ Top Streaks</Text>
          {rankedHabits.slice(0, 3).map((item, key) => (
            <View key={key} style={styles.rankingRow}>
              <View style={[styles.rankingBadge, badgeStyle[key]]}>
                <Text style={styles.rankingBadgeText}>{key + 1} </Text>
              </View>
              <Text style={styles.rankingHabit}>{item.habit.title}</Text>
              <Text style={styles.rankingStreak}>{item.bestStreak}</Text>
            </View>
          ))}
        </View>
      )}

      {habits.length === 0 ? (
        <View>
          <Text>No Habits yet. Add your first Habit!</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.container}
        >
          {rankedHabits.map(({ habit, streak, bestStreak, total }, key) => (
            <Card
              key={key}
              style={[styles.card, key === 0 && styles.firstCard]}
            >
              <Card.Content>
                <Text variant="titleMedium" style={styles.habitTitle}>
                  {habit.title}
                </Text>
                <Text style={styles.habitDescription}>{habit.description}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statsBadge}>
                    <Text style={styles.statsBadgeText}>🔥{streak}</Text>
                    <Text style={styles.statsLabel}>Current</Text>
                  </View>
                  <View style={styles.statsBadgeGold}>
                    <Text style={styles.statsBadgeText}>🏆{bestStreak}</Text>
                    <Text style={styles.statsLabel}>Best</Text>
                  </View>
                  <View style={styles.statsBadgeGreen}>
                    <Text style={styles.statsBadgeText}>✅{total}</Text>
                    <Text style={styles.statsLabel}>Total</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 16,
  },
  card: {
    marginBottom: 18,
    borderRadius: 18,
    backgroundColor: "#fff",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  firstCard: {
    borderWidth: 2,
    borderColor: "#7c4dff",
  },
  habitTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 2,
  },
  habitDescription: {
    color: "#6c6c80",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 8,
  },
  statsBadge: {
    backgroundColor: "#fff3e0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 60,
  },
  statsBadgeGold: {
    backgroundColor: "#fffde7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 60,
  },
  statsBadgeGreen: {
    backgroundColor: "#e8f5e9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 60,
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#22223b",
  },
  statsBadgeText: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#22223b",
  },
  rankingContainer: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  rankingTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 12,
    color: "#7c4dff",
    letterSpacing: 0.5,
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 8,
  },
  rankingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#e0e0e0",
  },
  badge1: { backgroundColor: "#ffd700" },
  badge2: { backgroundColor: "#c0c0c0" },
  badge3: { backgroundColor: "#cd7f32" },

  rankingBadgeText: {
    fontWeight: "bold",
    color: "#fff",
    fontSize: 15,
  },
  rankingHabit: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  rankingStreak: {
    fontWeight: "bold",
    color: "fff",
    fontSize: 15,
  },
});
