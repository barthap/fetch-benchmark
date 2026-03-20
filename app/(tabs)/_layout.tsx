import { Tabs } from "expo-router";
import { Appbar } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        header: (props) => (
          <Appbar.Header>
            <Appbar.Content title={props.options.title ?? "Fetch Benchmark"} />
          </Appbar.Header>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Whole-Body",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="download" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="streaming"
        options={{
          title: "Streaming",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="wave" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
