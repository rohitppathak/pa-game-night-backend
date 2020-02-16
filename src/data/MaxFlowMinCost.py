from __future__ import print_function
from ortools.graph import pywrapgraph
import sys
import json


def main():
  start_nodes = json.loads(sys.argv[1])
  end_nodes = json.loads(sys.argv[2])
  capacities = json.loads(sys.argv[3])
  unit_costs = json.loads(sys.argv[4])
  node_to_supplies = json.loads(sys.argv[5])
  node_to_data_objects = json.loads(sys.argv[6])

  min_cost_flow = pywrapgraph.SimpleMinCostFlow()

  for i in range(0, len(start_nodes)):
    min_cost_flow.AddArcWithCapacityAndUnitCost(start_nodes[i], end_nodes[i],
                                                capacities[i], unit_costs[i])

  for node, supply in node_to_supplies.items():
    min_cost_flow.SetNodeSupply(int(node), supply)

  games_to_users = {}
  min_cost_flow.SolveMaxFlowWithMinCost()
  for i in range(min_cost_flow.NumArcs()):
    if min_cost_flow.Head(i) > 0 and min_cost_flow.Flow(i) > 0:
      game_name = node_to_data_objects[str(min_cost_flow.Head(i))]['name']
      game_id = node_to_data_objects[str(min_cost_flow.Head(i))]['gameId']
      game_min_players = node_to_data_objects[str(min_cost_flow.Head(i))][
        'minPlayers']
      game_max_players = node_to_data_objects[str(min_cost_flow.Head(i))][
        'maxPlayers']
      game_users_cost = games_to_users.get(game_id, {'user_list': [],
                                                     'cost': 0,
                                                     'gameName': game_name,
                                                     'minPlayers': game_min_players,
                                                     'maxPlayers': game_max_players})
      user_node = node_to_data_objects[str(min_cost_flow.Tail(i))]
      game_users_cost['user_list'].append({'id': user_node['userId'],
                                           'username': user_node['username'],
                                           'ranking': min_cost_flow.UnitCost(i)})
      game_users_cost['cost'] += min_cost_flow.UnitCost(i)
      games_to_users[game_id] = game_users_cost

  print(json.dumps(games_to_users))


if __name__ == '__main__':
  main()
